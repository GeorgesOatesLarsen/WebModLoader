export type WorkFunctionProgressCallback = (workFunctionProgress:number)=>Promise<void>;
export type OperationWorkFunction = (operation: Operation, callbacks: SubOperationCallbackSet,
                                     workFunctionProgressCallback : WorkFunctionProgressCallback,
                                     ...args) => Promise<void>;
export type OperationProgressCallback = (stages : string[], progresses : number[]) => Promise<void>;
export type SubOperationCallback = (...args:any[])=>Promise<void>;
export type SubOperationCallbackSet = {
    [callback:string]: SubOperationCallback,
};
export type ArtifactType = "error" | "debug" | "info" | "source" | "operation";
export type ArtifactPayload = string | number | boolean
    | { [x: string]: ArtifactPayload }
    | Array<ArtifactPayload>;

export type ArtifactFilter = ((artifact : OperationArtifact) => boolean) | ArtifactType[];
type OperationExecutionContext = {stack: OperationExecutionStackLayer[], lastUpdate: number};

//Idea: Minimum time estimate? How to allow a late-stage operation to drastically expand its time estimate?
//Other idea: Allow operations to lock their time estimate once they become certain
//Locked tasks will remap their time values to the original value seen at time of lock
//Useful for giving sane values to initial estimates.


interface OperationExecutionStackLayer {
    completedChildTime: number,
    workFunctionTime: number,
    operation: Operation
};

export class Operation {
    name : string;
    workCallback : OperationWorkFunction;

    subOperations : Set<Operation>;
    subOperationBindings : SubOperationBindingSet;

    parentOperation : Operation;
    showSubOperations : boolean;
    artifacts : Map<string, OperationArtifact>;

    speculatedWorkload : number; //
    childWorkloadTotal : number; // The sum of the workloads of all children of this task
    workFunctionWorkload : number; // The amount of work (in seconds) that the workload function is predicted to take;
    executing : boolean;

    /**
     * Create an Operation, that is capable of estimating and reporting back on its progress, as well as collecting
     * relevant Operation Artifacts.
     * @param callback - The work function for the operation. Passed in a reference to this Operation, which it may use
     *                   to call sub-operations.
     * @param speculatedWorkload - The amount of work (in seconds) this operation predicts it will likely need.
     *                             This amount is ALWAYS what is contributed to the parent operation, regardless of the
     *                             actual total of child workload. This number should ideally include the workload
     *                             expected to be contributed by child tasks AND the workload function.
     * @param workFunctionWorkload - The amount of work (in seconds) expected to be done by the workload function itself.
     * @param name - The (human readable) name of the operation.
     * @param showSubOperations - Should we bother to include the operation names of sub-operations in progress reports?
     */
    constructor(name: string, callback: OperationWorkFunction = async ()=>{}, speculatedWorkload: number,
                workFunctionWorkload, showSubOperations : boolean = true) {
        if (!callback) {
            throw new Error ("Operation must have a callback");
        }
        if (callback.name === 'anonymous' || callback.name === '' || !callback.name) {
            throw new Error ("Operation callback must be named (cannot be anonymous)");
        }
        if (!isNaN(parseInt(callback.name))) {
            throw new Error ("Operation callback name cannot be numeric");
        }
        this.name = name;
        this.workCallback = callback;
        this.speculatedWorkload = speculatedWorkload;
        this.workFunctionWorkload = workFunctionWorkload;
        this.childWorkloadTotal = 0;
        this.executing = false;
        this.showSubOperations = showSubOperations;
        this.subOperations = new Set<Operation>();
        this.subOperationBindings = new SubOperationBindingSet(this);
        this.artifacts = new Map<string, OperationArtifact>();
    }

    createSubOperation(name: string, callback: OperationWorkFunction,
                       speculatedWorkload : number, workFunctionWorkload : number,
                       options : {
                            showSubOperations? : boolean,
                            bindingName?: string,
                            groupName?: string
                       } = {}) {
        options.showSubOperations ??= true;
        if (options.bindingName && options.groupName) {
            throw new Error("An operation cannot be bound to both a group and as a single binding.");
        }
        if (options.groupName) {
            return this.addSubOperation(
                new Operation(name, callback, speculatedWorkload,
                              workFunctionWorkload, options.showSubOperations),
                options.groupName,
                true);
        } else {
            return this.addSubOperation(
                new Operation(name, callback, speculatedWorkload,
                    workFunctionWorkload, options.showSubOperations),
                options.bindingName,
                false);
        }
    }

    addSubOperationToGroup(operation: Operation, groupName : string) {
        return this.addSubOperation(operation, groupName, true);
    }
    addSubOperation(operation: Operation, bindingName : string = operation.workCallback.name, group : boolean = false) {
        if (operation.executing) {
            throw new Error("SubOperations may not be added to executing operations!");
        }

        this.subOperations.add(operation);
        if (group) {
            this.subOperationBindings.addBindingToGroup(bindingName, operation);
        } else {
            this.subOperationBindings.addBinding(bindingName, operation);
        }
        operation.parentOperation = this;
        this.childWorkloadTotal += operation.speculatedWorkload;
        return operation;
    }

    /**
     * Executes the operation. The operation's work function will be called with a sub-operation callback set and
     * a progress reporting function. The work function should call each of the sub-operation callbacks exactly once.
     * If the work function contributes significantly to computation time, the work function should periodically call
     * the progress reporting function, passing an estimate of the percentage of work completed, excluding work
     * handled by sub-operation
     *
     * @param progressCallback - During execution, this progress callback will be called (awaited) periodically,
     *                           no more often than every 0.1% of progress.
     * @param timeStack - Do not provide when calling. For internal use. Tracks the total time of all upstream tasks
     *                    when recursing.
     * @param operationStack - Do not provide when calling. For internal use. Stores the list of upstream tasks when
     *                         resursing.
     * @param lastUpdate - Do not provide when calling, used for deciding when to reprot progress
     * @param displayed - Do not provide when calling, tracks whether any upstream tasks were marked as not displayed.
     */
    async execute(progressCallback : OperationProgressCallback, ...args) {
        await this.executeInternal(progressCallback, {stack:[], lastUpdate:Date.now()}, true, ...args);
    }

    private async executeInternal(progressCallback : OperationProgressCallback,
                                 context : OperationExecutionContext,
                                 displayed : boolean = true, ...args) {
        if (this.executing) {
            throw new Error(`${this.getFullName()} is already executing!`);
        }
        this.executing = true;

        //Deepen the operation tracking stacks
        context.stack.push({
            completedChildTime: 0, // The total time spent on COMPLETED child tasks
            workFunctionTime: 0, // The total time spent THUS FAR on this operation's workFunction
            operation: this
        });
        let stackLatest = context.stack[context.stack.length - 1];

        //Helper function to check and keep track of whether a progress update is appropriate (based on whether the
        //last progress report was more than approximately 0.01 seconds ago, and whether there are any upstream
        //non-display operations)
        const gateProgressReport = () => {
            return true;
            let gateOpen = (displayed && (Date.now() - context.lastUpdate > 10));
            if (gateOpen) {
                context.lastUpdate = Date.now();
            }
            return gateOpen;
        };

        // Sends a progress report based on the timeStack,
        // and a provided estimate of the completion of the current work function
        const sendProgressReport = async (workFunctionProgress : number = stackLatest.workFunctionTime) => {
            //Update the current workFunctionProgress, even if we don't actually submit the update!
            stackLatest.workFunctionTime = Math.max(stackLatest.workFunctionTime,
                                                    Math.min(workFunctionProgress, 1) * this.workFunctionWorkload);

            //Compute a stage name stack
            let stageStack = context.stack.map(layer => layer.operation.name);

            //Compute a granular cumulative time stack
            let cumulativeStack = context.stack.reduceRight((cs:number[], layer : OperationExecutionStackLayer,
                                                             i) => {
                let activeChildOperation = (cs.length > 0) ? (context.stack[i+1].operation) : null;
                const granularChildTotal = activeChildOperation?activeChildOperation.workToParentWork(cs[0]):0;
                return [granularChildTotal + layer.completedChildTime + layer.workFunctionTime, ...cs];
            }, []);

            //Compute a progress stack
            let progressStack = cumulativeStack.map((cum, i) => {
                return context.stack[i].operation.workToProgress(cum);
            })

            //Now pass these values off to the true progress reporting callback!
            await progressCallback(stageStack, progressStack);
        }

        // Create a series of callbacks that the operation work function can call to execute sub-operations
        let cbs : SubOperationCallbackSet = {};
        for (let [groupName, group] of this.subOperationBindings.groups) {
            cbs[groupName] = async (...args:any) => {
                for (let op of group) {
                    await op.executeInternal(progressCallback, context, displayed && this.showSubOperations,
                                             ...args);
                    stackLatest.completedChildTime += op.speculatedWorkload;
                }
            }
        }
        for (let [name, op] of this.subOperationBindings.callbacks) {
            cbs[name] = async (...args:any) => {
                await op.executeInternal(progressCallback, context, displayed && this.showSubOperations,
                    ...args);
                stackLatest.completedChildTime += op.speculatedWorkload;
            }
        }

        const workFunctionProgressCallback : WorkFunctionProgressCallback = async (progress : number) => {
            if (gateProgressReport()) {
                await sendProgressReport(progress);
            }
        }

        await this.workCallback(this, cbs, workFunctionProgressCallback, ...args);

        //Try to update on progress roughly once every 0.01 seconds.
        if (gateProgressReport()) {
            await sendProgressReport();
        }

        context.stack.pop();
    }

    getFullName() {
        return (this.parentOperation? this.parentOperation.getFullName() + " > " : "") + this.name;
    }

    addArtifact(artifact : OperationArtifact) {
        this.artifacts.set(artifact.name, artifact);
        artifact.setParent(this);
    }

    getArtifactTree(filter : ArtifactFilter) {
        if (Array.isArray(filter)) {
            return this.getArtifactTree((artifact : OperationArtifact) => filter.includes(artifact.type));
        }
        const tree = {};

        for (let operation of this.subOperations) {
            tree[operation.name] = operation.getArtifactTree(filter);
        }

        for (let [name, artifact] of this.artifacts) {
            tree[name] = {
                ...tree[name],
                ...artifact.payload as object
            };
        }
        return tree;
    }


    /**
     * Converts a given amount of work to amount of work contributed as child work in the
     * parent operation.
     * @param childWork - The total amount of work done (both child work, and workFunction work)
     */
    workToParentWork(totalWork : number) : number {
        return this.progressToParentWork(this.workToProgress(totalWork));
    }

    /**
     * Converts a given amount of child work and workFunction work to a total progress
     * @param childWork - The total amount of work done (both child work, and workFunction work)
     */
    workToProgress(totalWork : number) : number {
        const totalEstimate = this.childWorkloadTotal || 0 + this.workFunctionWorkload || 0;
        return Math.min(1, Math.max(0, totalEstimate?(totalWork/totalEstimate):1));
    }

    /**
     * Converts a progress percentage into total amount of work contributed as child work in the parent operation
     * @param progress - The progress to convert
     */
    progressToParentWork(progress: number) : number {
        return progress * this.speculatedWorkload;
    }
}

class SubOperationBindingSet {
    groups : Map<string, Operation[]>;
    callbacks: Map<string, Operation>;
    private parent : Operation;
    constructor(parent: Operation) {
        this.groups = new Map<string, Operation[]>();
        this.callbacks = new Map<string, Operation>();
        this.parent = parent;
    }
    addBinding(name: string, bound: Operation) {
        if (this.callbacks.has(name)) {
            throw new Error(`${this.parent.getFullName()} already has an operation named ${name}!`);
        }
        if (this.groups.has(name)) {
            throw new Error(`${this.parent.getFullName()} already has an operation group named ${name}!`);
        }
        this.callbacks.set(name, bound);
    }
    addBindingToGroup(groupName: string, bound: Operation) {
        this.addGroup(groupName);
        this.groups.get(groupName).push(bound);
    }
    addGroup(groupName : string) {
        if (this.callbacks.has(groupName)) {
            throw new Error(`${this.parent.getFullName()} already has an operation named ${name}!`);
        }
        if (!this.groups.has(groupName)) {
            this.groups.set(groupName, []);
        }
    }
}

export class OperationArtifact {
    /**
     * Create a single Artifact with a name, a payload, and in-memory references
     * @param name - The name of the payload (for looking it up, or comparing it)
     * @param payload - The JSON-compatible payload to be saved in the artifact tree
     * @param references - Any in-memory JS object. Not saved, but possibly useful for debugging
     * @param type - The Artifact Type
     */
    type: ArtifactType;
    name: string;
    payload: ArtifactPayload;
    reference: any;
    parentOperation: Operation;
    constructor(type: ArtifactType, name: string, payload: ArtifactPayload, reference: any = undefined) {
        this.type = type;
        this.name = name;
        this.payload = payload;
        this.reference = reference;
    }
    setParent(operation: Operation) : void {
        this.parentOperation = operation;
    }
    log(...args) {
        console.log(...this.logArgs(...args));
    }
    trace(...args) {
        console.trace(...this.logArgs(...args))
    }
    logArgs(...args) {
        const pname = this.parentOperation ? this.parentOperation.getFullName() : "parentless";
        return [`Artifact Log: ${pname} > ${this.name}`, this.payload, this.reference, ...args];
    }
}