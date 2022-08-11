import {
    Operation,
    OperationProgressCallback,
    SubOperationCallbackSet,
    WorkFunctionProgressCallback
} from "./OperationManagement";


export type loadModifiedSourcesCallback = (modifiedSources : Map<string, string>) => Promise<void>;
export type getTargetSourcesCallback =  () => Promise<Map<string, string>>;
export class WebModLoader {
    loadModsOperation : Operation;
    bindingGenerationOperation : Operation;
    injectionPlanningOperation : Operation;
    constructor() {
        this.loadModsOperation =                  new Operation("LoadMods", this.bindMethod(this.LoadMods),                                                                   1,  1);
                                                  this.loadModsOperation.createSubOperation("Acquisition", this.bindMethod(this.ModAcquisition),                              1,  1);
                                                  this.loadModsOperation.createSubOperation("Load Ordering", this.bindMethod(this.ModLoadOrdering),                           1,  1);
        let sourceModificationOperation =         this.loadModsOperation.createSubOperation("Source Modification", this.bindMethod(this.SourceModification),                  300,0);
                                                    sourceModificationOperation.createSubOperation("Cached Load", this.bindMethod(this.CachedLoad),                           20, 1);
        let injectionLoadOperation =                sourceModificationOperation.createSubOperation("Injection Load", this.bindMethod(this.InjectionLoad),                     320,1);
                                                      injectionLoadOperation.createSubOperation("Binding Acquisition", this.bindMethod(this.InjectionBindingAcquisition),     1,  1);
                                                      injectionLoadOperation.createSubOperation("Binding Ordering", this.bindMethod(this.InjectionBindingOrdering),           1,  1);
        this.bindingGenerationOperation =             injectionLoadOperation.createSubOperation("Binding Generation", this.bindMethod(this.InjectionBindingGeneration),       100,1);
        this.injectionPlanningOperation =             injectionLoadOperation.createSubOperation("Injection Planning", this.bindMethod(this.InjectionPlanning),                100, 1);
                                                      injectionLoadOperation.createSubOperation("Injection Application", this.bindMethod(this.InjectionApplication),          100, 30);
                                                      injectionLoadOperation.createSubOperation("Modded Source Generation", this.bindMethod(this.ModdedSourceGeneration),     20, 20);
                                                  this.loadModsOperation.createSubOperation("Load Modified Sources", this.bindMethod(this.LoadModifiedSources),               20, 20);
                                                  this.loadModsOperation.createSubOperation("Mod Pre-Initialization", this.bindMethod(this.ModPreInitialization),             1,  1);
        let APISetupOperation =                   this.loadModsOperation.createSubOperation("API Setup", this.bindMethod(this.APISetup),                                      1,  1);
                                                    APISetupOperation.createSubOperation("Acquisition", this.bindMethod(this.APIAcquisition),                                 1,  1);
                                                    APISetupOperation.createSubOperation("Load Ordering", this.bindMethod(this.APILoadOrdering),                              1,  1);
                                                    APISetupOperation.createSubOperation("API Loading", this.bindMethod(this.APILoading),                                     1,  1);
                                                  this.loadModsOperation.createSubOperation("Final Initialization", this.bindMethod(this.FinalInitialization),                1,  1);
    }

    /**
     * This is like .bind, except the returned function's name is set to the name of the class member function being bound
     * @param func - The class member function to bind!
     */
    bindMethod<btype extends (...args : any[]) => Promise<any>>(func : btype) : btype {
        let binding = func.bind(this);
        let tempObject = {
            [func.name](...args){
                return binding(...args)
            }
        };
        //I am sorry for this black magic
        return tempObject[func.name] as btype;
    }

    /**
     * Initialize the WebModLoader and begin loading mods!
     * @param getTargetSources - A callback that can be called to obtain the target sources
     * @param loadModifiedSources - A callback that can be called to load the target sources once they are modified;
     * @constructor
     */
    async Initialize(getTargetSources : getTargetSourcesCallback,
                     loadModifiedSources : loadModifiedSourcesCallback,
                     progressCallback : OperationProgressCallback) {
        await this.loadModsOperation.execute(progressCallback, getTargetSources, loadModifiedSources);
    }

    async LoadMods(operation: Operation, callbacks: SubOperationCallbackSet,
                   workFunctionProgressCallback : WorkFunctionProgressCallback,
                   getTargetSources : getTargetSourcesCallback, loadModifiedSources : loadModifiedSourcesCallback) {
        await callbacks.ModAcquisition();
        await callbacks.ModLoadOrdering();
        await callbacks.SourceModification();
        await callbacks.LoadModifiedSources();
        await callbacks.ModPreInitialization();
        await callbacks.FinalInitialization();
    }

    async ModAcquisition(operation: Operation, callbacks: SubOperationCallbackSet,
                         workFunctionProgressCallback : WorkFunctionProgressCallback,
                         ...args) {
    }

    async ModLoadOrdering(operation: Operation, callbacks: SubOperationCallbackSet,
                          workFunctionProgressCallback : WorkFunctionProgressCallback,
                         ...args) {
    }

    async SourceModification(operation: Operation, callbacks: SubOperationCallbackSet,
                             workFunctionProgressCallback : WorkFunctionProgressCallback,
                         ...args) {
        await callbacks.CachedLoad();
        await callbacks.InjectionLoad();
    }

    async CachedLoad(operation: Operation, callbacks: SubOperationCallbackSet,
                     workFunctionProgressCallback : WorkFunctionProgressCallback,
                              ...args) {
    }

    async InjectionLoad(operation: Operation, callbacks: SubOperationCallbackSet,
                        workFunctionProgressCallback : WorkFunctionProgressCallback,
                             ...args) {
        await callbacks.InjectionBindingAcquisition();
        await callbacks.InjectionBindingOrdering();
        await callbacks.InjectionBindingGeneration();
        await callbacks.InjectionPlanning();
        await callbacks.InjectionApplication();
        await callbacks.ModdedSourceGeneration();
    }

    async InjectionBindingAcquisition(operation: Operation,callbacks: SubOperationCallbackSet,
                                      workFunctionProgressCallback : WorkFunctionProgressCallback,
                          ...args) {
    }

    async InjectionBindingOrdering(operation: Operation, callbacks: SubOperationCallbackSet,
                                   workFunctionProgressCallback : WorkFunctionProgressCallback,
                                      ...args) {
    }

    async InjectionBindingGeneration(operation: Operation, callbacks: SubOperationCallbackSet,
                                     workFunctionProgressCallback : WorkFunctionProgressCallback,
                                      ...args) {
        if (callbacks.generateBindings) {
            await callbacks.generateBindings();
        }
    }

    async InjectionPlanning(operation: Operation, callbacks: SubOperationCallbackSet,
                            workFunctionProgressCallback : WorkFunctionProgressCallback,
                              ...args) {
        if (callbacks.planInjections) {
            await callbacks.planInjections();
        }
    }

    async InjectionApplication(operation: Operation, callbacks: SubOperationCallbackSet,
                               workFunctionProgressCallback : WorkFunctionProgressCallback,
                            ...args) {
    }

    async ModdedSourceGeneration(operation: Operation, callbacks: SubOperationCallbackSet,
                                 workFunctionProgressCallback : WorkFunctionProgressCallback,
                             ...args) {
    }

    async LoadModifiedSources(operation: Operation, callbacks: SubOperationCallbackSet,
                              workFunctionProgressCallback : WorkFunctionProgressCallback,
                                 ...args) {
    }

    async ModPreInitialization(operation: Operation, callbacks: SubOperationCallbackSet,
                               workFunctionProgressCallback : WorkFunctionProgressCallback,
                             ...args) {
    }

    async APISetup(operation: Operation, callbacks: SubOperationCallbackSet,
                   workFunctionProgressCallback : WorkFunctionProgressCallback,
                               ...args) {
        await callbacks.APIAcquisition();
        await callbacks.APILoadOrdering();
        await callbacks.APILoading();
    }

    async APIAcquisition(operation: Operation, callbacks: SubOperationCallbackSet,
                         workFunctionProgressCallback : WorkFunctionProgressCallback,
                   ...args) {
    }

    async APILoadOrdering(operation: Operation, callbacks: SubOperationCallbackSet,
                          workFunctionProgressCallback : WorkFunctionProgressCallback,
                         ...args) {
    }

    async APILoading(operation: Operation, callbacks: SubOperationCallbackSet,
                     workFunctionProgressCallback : WorkFunctionProgressCallback,
                          ...args) {
    }

    async FinalInitialization(operation: Operation, callbacks: SubOperationCallbackSet,
                              workFunctionProgressCallback : WorkFunctionProgressCallback,
                          ...args) {
    }
}