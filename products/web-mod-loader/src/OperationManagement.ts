export type SubOperationCallback = ()=>Promise<void>;
export type SubOperationCallbackSet = {[x :string]: SubOperationCallback};
export type OperationCallback = (operation: Operation, callbacks: SubOperationCallbackSet) => Promise<void>;
export type OperationProgressCallback = (stages : string[], progresses : number[]) => Promise<void>;
export type ArtifactType = "error" | "debug" | "info" | "source" | "operation";
export type ArtifactPayload = string | number | boolean
    | { [x: string]: ArtifactPayload }
    | Array<ArtifactPayload>;

export type ArtifactFilter = ((artifact : OperationArtifact) => boolean) | ArtifactType[];

export class Operation {
    name : string;
    workCallback : OperationCallback;
    callbackTimeEstimate : number;
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
    constructor(callback: OperationCallback, workEstimateSeconds: number, name: string, showSubOperations : boolean = true) {
        this.name = name;
        this.workCallback = callback;
        this.callbackTimeEstimate = workEstimateSeconds;
        this.totalTimeEstimate = workEstimateSeconds;
        this.showSubOperations = showSubOperations;
        this.subOperations = new Map<string, Operation>();
        this.artifacts = new Map<string, OperationArtifact>();
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
    }

    async execute(progressCallback : OperationProgressCallback,
                  timeStack : number[] = [],
                  estimateStack : number[] = [],
                  operationStack : Operation[] = [],
                  totalTime : number = this.totalTimeEstimate,
                  lastUpdate : number = -1,
                  displayed : boolean = true) {

        //Deepen the operation tracking stacks
        timeStack.push(0);
        estimateStack.push(this.totalTimeEstimate);
        operationStack.push(this);

        // Create a series of callbacks that the operation work function can call to execute sub-operations
        const subopcallbacks : SubOperationCallbackSet = {};
        const latest = timeStack.length - 1;
        for (let [name, operation] of this.subOperations) {
            subopcallbacks[name] = async () => {
                await operation.execute(progressCallback, timeStack, estimateStack, operationStack, totalTime, lastUpdate, displayed && this.showSubOperations);
                timeStack[latest] = Math.min(timeStack[latest] + operation.totalTimeEstimate, this.totalTimeEstimate);
                totalTime += operation.totalTimeEstimate;

                //Try to update on progress roughly once every 0.1 percent.
                if (displayed && totalTime/operationStack[0].totalTimeEstimate - lastUpdate > 0.001) {
                    lastUpdate = totalTime/operationStack[0].totalTimeEstimate;
                    let stageStack = operationStack.map(op => op.name);
                    let cumulativeTime = 0;
                    let progressStack = timeStack.map((val) => cumulativeTime += val).map((time, i) => {
                        return time/operationStack[i].totalTimeEstimate;
                    });
                    await progressCallback(stageStack, progressStack);
                }
            };
        }

        await this.workCallback(this, subopcallbacks);

        //Drain the operation tracking stacks
        timeStack.pop();
        estimateStack.pop();

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