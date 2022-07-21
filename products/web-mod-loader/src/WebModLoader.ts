import {
    Operation,
    OperationProgressCallback,
    SubOperationCallbackSet,
    WorkFunctionProgressCallback
} from "./OperationManagement";


export type loadModifiedSourcesCallback = (modifiedSources : Map<string, string>) => Promise<void>;
export type getTargetSourcesCallback =  () => Promise<Map<string, string>>;
export class WebModLoader {
    name : string;
    rootOperation : Operation;
    constructor(name: string) {
        this.name = name;
        this.rootOperation = new Operation(this.name, async ()=>{}, 0, true);
        let loadModsOperation =                 this.rootOperation.createSubOperation("LoadMods", this.LoadMods.bind(this),                                             0,      true);
                                                  loadModsOperation.createSubOperation("Acquisition", this.ModAcquisition.bind(this),                                   0,      true);
                                                  loadModsOperation.createSubOperation("Load Ordering", this.ModLoadOrdering.bind(this),                                0,      true);
        let sourceModificationOperation =         loadModsOperation.createSubOperation("Source Modification", this.SourceModification.bind(this),                       0,      true);
                                                    sourceModificationOperation.createSubOperation("Cached Load", this.CachedLoad.bind(this),                           0,      true);
        let injectionLoadOperation =                sourceModificationOperation.createSubOperation("Injection Load", this.InjectionLoad.bind(this),                     0,      true);
                                                      injectionLoadOperation.createSubOperation("Binding Acquisition", this.InjectionBindingAcquisition.bind(this),     0,      true);
                                                      injectionLoadOperation.createSubOperation("Binding Ordering", this.InjectionBindingOrdering.bind(this),           0,      true);
                                                      injectionLoadOperation.createSubOperation("Binding Generation", this.InjectionBindingGeneration.bind(this),       0,      true);
                                                      injectionLoadOperation.createSubOperation("Injection Planning", this.InjectionPlanning.bind(this),                0,      true);
                                                      injectionLoadOperation.createSubOperation("Injection Application", this.InjectionApplication.bind(this),          0,      true);
                                                      injectionLoadOperation.createSubOperation("Modified Source Generation", this.ModdedSourceGeneration.bind(this),   0,      true);
                                                  loadModsOperation.createSubOperation("Load Modified Sources", this.LoadModifiedSources.bind(this),                    0,      true);
                                                  loadModsOperation.createSubOperation("Mod Pre-Initialization", this.ModPreInitialization.bind(this),                  0,      true);
        let APISetupOperation =                   loadModsOperation.createSubOperation("API Setup", this.APISetup.bind(this),                                           0,      true);
                                                    APISetupOperation.createSubOperation("Acquisition", this.APIAcquisition.bind(this),                                 0,      true);
                                                    APISetupOperation.createSubOperation("Load Ordering", this.APILoadOrdering.bind(this),                              0,      true);
                                                    APISetupOperation.createSubOperation("API Loading", this.APILoading.bind(this),                                     0,      true);
                                                  loadModsOperation.createSubOperation("Final Initialization", this.LoadModifiedSources.bind(this),                     0,      true);

    }

    /**
     * Initialize the WebModLoader and begin loading mods!
     * @param getTargetSources - A callback that can be called to obtain the target sources
     * @param loadModifiedSources - A callback that can be called to load the target sources once they are modified;
     * @constructor
     */
    async Initialize(getTargetSources : getTargetSourcesCallback,
                     loadModifiedSources : loadModifiedSourcesCallback,
                     workEstimateCallback : OperationProgressCallback) {
        await this.rootOperation.execute(workEstimateCallback, getTargetSources, loadModifiedSources);
    }

    async LoadMods(operation: Operation, callbacks: SubOperationCallbackSet, workFunctionProgressCallback : WorkFunctionProgressCallback,
                   getTargetSources : getTargetSourcesCallback, loadModifiedSources : loadModifiedSourcesCallback) {

    }

    async ModAcquisition(operation: Operation, callbacks: SubOperationCallbackSet, workFunctionProgressCallback : WorkFunctionProgressCallback,
                         ...args) {

    }

    async ModLoadOrdering(operation: Operation, callbacks: SubOperationCallbackSet, workFunctionProgressCallback : WorkFunctionProgressCallback,
                         ...args) {

    }

    async SourceModification(operation: Operation, callbacks: SubOperationCallbackSet, workFunctionProgressCallback : WorkFunctionProgressCallback,
                         ...args) {

    }

    async CachedLoad(operation: Operation, callbacks: SubOperationCallbackSet, workFunctionProgressCallback : WorkFunctionProgressCallback,
                              ...args) {

    }

    async InjectionLoad(operation: Operation, callbacks: SubOperationCallbackSet, workFunctionProgressCallback : WorkFunctionProgressCallback,
                             ...args) {

    }

        async InjectionBindingAcquisition(operation: Operation, callbacks: SubOperationCallbackSet, workFunctionProgressCallback : WorkFunctionProgressCallback,
                              ...args) {

        }

        async InjectionBindingOrdering(operation: Operation, callbacks: SubOperationCallbackSet, workFunctionProgressCallback : WorkFunctionProgressCallback,
                                          ...args) {

        }

        async InjectionBindingGeneration(operation: Operation, callbacks: SubOperationCallbackSet, workFunctionProgressCallback : WorkFunctionProgressCallback,
                                          ...args) {

        }

        async InjectionPlanning(operation: Operation, callbacks: SubOperationCallbackSet, workFunctionProgressCallback : WorkFunctionProgressCallback,
                                  ...args) {

        }

        async InjectionApplication(operation: Operation, callbacks: SubOperationCallbackSet, workFunctionProgressCallback : WorkFunctionProgressCallback,
                                ...args) {

        }

        async ModdedSourceGeneration(operation: Operation, callbacks: SubOperationCallbackSet, workFunctionProgressCallback : WorkFunctionProgressCallback,
                                 ...args) {

        }

    async LoadModifiedSources(operation: Operation, callbacks: SubOperationCallbackSet, workFunctionProgressCallback : WorkFunctionProgressCallback,
                                 ...args) {

    }

    async ModPreInitialization(operation: Operation, callbacks: SubOperationCallbackSet, workFunctionProgressCallback : WorkFunctionProgressCallback,
                             ...args) {

    }

    async APISetup(operation: Operation, callbacks: SubOperationCallbackSet, workFunctionProgressCallback : WorkFunctionProgressCallback,
                               ...args) {

    }

        async APIAcquisition(operation: Operation, callbacks: SubOperationCallbackSet, workFunctionProgressCallback : WorkFunctionProgressCallback,
                       ...args) {

        }

        async APILoadOrdering(operation: Operation, callbacks: SubOperationCallbackSet, workFunctionProgressCallback : WorkFunctionProgressCallback,
                             ...args) {

        }

        async APILoading(operation: Operation, callbacks: SubOperationCallbackSet, workFunctionProgressCallback : WorkFunctionProgressCallback,
                              ...args) {

        }

    async FinalInitialization(operation: Operation, callbacks: SubOperationCallbackSet, workFunctionProgressCallback : WorkFunctionProgressCallback,
                          ...args) {

    }
}