export type SubOperationCallback = (...args)=>Promise<void>;
export type SubOperationCallbackSet = {[x :string]: SubOperationCallback};
export type WorkFunctionProgressCallback = (workFunctionProgress:number)=>Promise<void>;
export type OperationWorkFunction = (operation: Operation, callbacks: SubOperationCallbackSet, workFunctionProgressCallback : WorkFunctionProgressCallback, ...args) => Promise<void>;
export type OperationProgressCallback = (stages : string[], progresses : number[]) => Promise<void>;
export type ArtifactType = "error" | "debug" | "info" | "source" | "operation";
export type ArtifactPayload = string | number | boolean
    | { [x: string]: ArtifactPayload }
    | Array<ArtifactPayload>;

export type ArtifactFilter = ((artifact : OperationArtifact) => boolean) | ArtifactType[];

//Idea: Minimum time estimate? How to allow a late-stage operation to drastically expand its time estimate?
//Other idea: Allow operations to lock their time estimate once they become certain
//Locked tasks will remap their time values to the original value seen at time of lock
//Useful for giving sane values to initial estimates.
export class Operation {
    name : string;
    workCallback : OperationWorkFunction;
    workFunctionTimeEstimate : number;
    subOperations : Map<string, Operation>;
    parentOperation : Operation;
    showSubOperations : boolean;
    totalTimeEstimate : number;
    artifacts : Map<string, OperationArtifact>;

    /**
     * Create an Operation, that is capable of estimating and reporting back on its progress, as well as collecting
     * relevant Operation Artifacts.
     * @param callback - The work function for the operation. Passed in a reference to this Operation, which it may use
     *                   to call sub-operations.
     * @param workEstimateSeconds - The estimated amount of time (in seconds) that the work function for this operation
     *                              will contribute. Do NOT include time contributed by sub operations in this value.
     * @param name - The (human readable) name of the operation.
     * @param showSubOperations - Should we bother to include the operation names of sub-operations in progress reports?
     */
    constructor(name: string, callback: OperationWorkFunction = async ()=>{}, workEstimateSeconds: number, showSubOperations : boolean = true) {
        this.name = name;
        this.workCallback = callback;
        this.workFunctionTimeEstimate = workEstimateSeconds;
        this.totalTimeEstimate = workEstimateSeconds;
        this.showSubOperations = showSubOperations;
        this.subOperations = new Map<string, Operation>();
        this.artifacts = new Map<string, OperationArtifact>();
    }

    createSubOperation(name: string, callback: OperationWorkFunction = async ()=>{}, workEstimateSeconds: number, showSubOperations : boolean = true) {
        return this.addSubOperation(new Operation(name, callback, workEstimateSeconds, showSubOperations));
    }

    addSubOperation(operation: Operation) {
        if (this[operation.name]) {
            throw new Error("The operation is already executing!");
        }

        this.subOperations.set(operation.name, operation);
        operation.parentOperation = this;

        //Recursively add the estimated time contribution to all parent operations.
        const initialTimeEstimate = operation.totalTimeEstimate;
        let operationContainer : Operation = this;
        while (operationContainer) {
            operationContainer.totalTimeEstimate += initialTimeEstimate;
            operationContainer = operationContainer.parentOperation;
        }
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
        await this.executeInternal(progressCallback, [], [], {time:Date.now()}, true, ...args);
    }

    /**
     * Internal recursive execution function that recursively passes needed state.
     *
     * @param progressCallback - Same as in execute()
     * @param timeStack - Tracks the total time of all upstream tasks
     *                    when recursing.
     * @param operationStack - Stores the list of upstream tasks when
     *                         resursing.
     * @param lastUpdate - Used for deciding when to reprot progress
     * @param displayed - Tracks whether any upstream tasks were marked as not displayed.
     */
    private async executeInternal(progressCallback : OperationProgressCallback,
                                 timeStack : number[] = [],
                                 operationStack : Operation[] = [],
                                 lastUpdate : {time: number} = {time:Date.now()},
                                 displayed : boolean = true, ...args) {
        //Deepen the operation tracking stacks
        timeStack.push(0); // Each entry in the stack tracks the total time spent on PREVIOUSLY COMPLETED tasks in each parent task
        operationStack.push(this);

        //Helper function to check and keep track of whether a progress update is appropriate (based on whether the
        //last progress report was more than approximately 0.01 seconds ago, and whether there are any upstream
        //non-display operations)
        const gateProgressReport = () => {
            let gateOpen = (displayed && (Date.now() - lastUpdate.time > 10));
            if (gateOpen) {
                lastUpdate.time = Date.now();
            }
            return gateOpen;
        };

        //Sends a progress report based on the timeStack, and a provided estimate of the completion of the current work function
        let currentWorkFunctionProgress = 0;
        const sendProgressReport = async (workFunctionProgress : number = currentWorkFunctionProgress) => {
            //Update the current workFunctionProgress, even if we don't actually submit the update!
            currentWorkFunctionProgress = Math.min(Math.max(workFunctionProgress, currentWorkFunctionProgress), 1);

            //Compute a stage name stack
            let stageStack = operationStack.map(op => op.name);

            //Convert the workFunctionProgress into a rough time estimate:
            let workFunctionTime = currentWorkFunctionProgress * this.workFunctionTimeEstimate;

            //Compute the CUMULATIVE progress of each task up the chain
            //"Cumulative" is a little ambiguous here. The time stack on its own only includes previously completed tasks in its tally,
            //If we have completed any subtasks in the current task, then we must account for that, and we do so by adding all of the child
            //time totals to each parent time total. Hence, the use of a reduce-right.
            let cumulativeStack = timeStack.reduceRight((cs:number[], childTime:number, i: number) => {
                //Grab the current cumulative total by reading the previously submitted value if it exists
                let totalOfChildren = (i == 0 ? 0 : cs[0]);
                //Account for the work function time estimate by adding it to the first time estimate
                //Also clamp the time contribution to the total time estimate (so that no subtask accidentally reports
                //more than 100% completion)
                let timeContribution = Math.min(childTime + (i == 0 ? workFunctionTime : 0), operationStack[i].totalTimeEstimate);
                return [totalOfChildren + timeContribution, ...cs];
            }, []);

            //Compute the progress stack, by dividing the cumulative time stack by the time estimate stack, essentially
            let progressStack = cumulativeStack.map((time, i) => {
                return time/operationStack[i].totalTimeEstimate;
            });

            //Now pass these values off to the true progress reporting callback!
            await progressCallback(stageStack, progressStack);
        }

        // Create a series of callbacks that the operation work function can call to execute sub-operations
        const subopcallbacks : SubOperationCallbackSet = {};
        const latest = timeStack.length - 1;
        for (let [name, operation] of this.subOperations) {
            subopcallbacks[name] = async (...subopargs) => {
                await operation.executeInternal(progressCallback, timeStack, operationStack, lastUpdate, displayed && this.showSubOperations, ...subopargs);
                timeStack[latest] = Math.min(timeStack[latest] + operation.totalTimeEstimate, this.totalTimeEstimate);

                //Try to update on progress roughly once every 0.01 seconds.
                if (gateProgressReport()) {
                    await sendProgressReport();
                }
            };
        }

        const workFunctionProgressCallback : WorkFunctionProgressCallback = async (progress : number) => {
            if (gateProgressReport()) {
                await sendProgressReport(progress);
            }
        }
        await this.workCallback(this, subopcallbacks, workFunctionProgressCallback, ...args);

        //Drain the operation tracking stacks
        timeStack.pop();
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

        for (let [name, operation] of this.subOperations) {
            tree[name] = operation.getArtifactTree(filter);
        }

        for (let [name, artifact] of this.artifacts) {
            tree[name] = {
                ...tree[name],
                ...artifact.payload as object
            };
        }
        return tree;
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