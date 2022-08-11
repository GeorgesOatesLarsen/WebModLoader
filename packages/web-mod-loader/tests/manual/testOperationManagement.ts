import {
    Operation,
    OperationProgressCallback,
    SubOperationCallbackSet,
    WorkFunctionProgressCallback
} from "../../src/OperationManagement";


export type loadModifiedSourcesCallback = (modifiedSources : Map<string, string>) => Promise<void>;
export type getTargetSourcesCallback =  () => Promise<Map<string, string>>;

const fakeModList = ["ModOne", "ModTwo", "ModThree", "ModFour", "ModFive", "ModSix"];
const sleep = ms => new Promise(r => setTimeout(r, ms));


async function main() {
    let test = new OperationManagementTest();
    await test.Initialize(null, null, async (nameStack, progressStack) => {
        console.log(nameStack.reduce((fn, n, i) => {
            return `${fn}, ${Math.floor(progressStack[i] * 1000)/10.0}`
            return `${fn} -> ${n} (${Math.floor(progressStack[i] * 100)}%)`;
        }, ""));
        await sleep(1);
    });
}


class OperationManagementTest {
    loadModsOperation : Operation;
    bindingGenerationOperation : Operation;
    injectionPlanningOperation : Operation;
    constructor() {
        this.loadModsOperation =                  new Operation("LoadMods", this.bindMethod(this.LoadMods),                                                                   1,  1);
                                                  this.loadModsOperation.createSubOperation("Acquisition", this.bindMethod(this.ModAcquisition),                              1,  1);
                                                  this.loadModsOperation.createSubOperation("Load Ordering", this.bindMethod(this.ModLoadOrdering),                           1,  1);
        let sourceModificationOperation =         this.loadModsOperation.createSubOperation("Source Modification", this.bindMethod(this.SourceModification),                  620,0);
                                                    sourceModificationOperation.createSubOperation("Cached Load", this.bindMethod(this.CachedLoad),                           20, 1);
        let injectionLoadOperation =                sourceModificationOperation.createSubOperation("Injection Load", this.bindMethod(this.InjectionLoad),                     600,1);
                                                      injectionLoadOperation.createSubOperation("Binding Acquisition", this.bindMethod(this.InjectionBindingAcquisition),     1,  1);
                                                      injectionLoadOperation.createSubOperation("Binding Ordering", this.bindMethod(this.InjectionBindingOrdering),           1,  1);
        this.bindingGenerationOperation =             injectionLoadOperation.createSubOperation("Binding Generation", this.bindMethod(this.InjectionBindingGeneration),       600,1);
        this.injectionPlanningOperation =             injectionLoadOperation.createSubOperation("Injection Planning", this.bindMethod(this.InjectionPlanning),                20, 1);
                                                      injectionLoadOperation.createSubOperation("Injection Application", this.bindMethod(this.InjectionApplication),          30, 30);
                                                      injectionLoadOperation.createSubOperation("Modded Source Generation", this.bindMethod(this.ModdedSourceGeneration),     60, 60);
                                                  this.loadModsOperation.createSubOperation("Load Modified Sources", this.bindMethod(this.LoadModifiedSources),               60, 60);
                                                  this.loadModsOperation.createSubOperation("Mod Pre-Initialization", this.bindMethod(this.ModPreInitialization),             2,  1);
        let APISetupOperation =                   this.loadModsOperation.createSubOperation("API Setup", this.bindMethod(this.APISetup),                                      2,  1);
                                                    APISetupOperation.createSubOperation("Acquisition", this.bindMethod(this.APIAcquisition),                                 2,  1);
                                                    APISetupOperation.createSubOperation("Load Ordering", this.bindMethod(this.APILoadOrdering),                              2,  1);
                                                    APISetupOperation.createSubOperation("API Loading", this.bindMethod(this.APILoading),                                     2,  1);
                                                  this.loadModsOperation.createSubOperation("Final Initialization", this.bindMethod(this.FinalInitialization),                2,  1);
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
        await sleep(1000);
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
        await sleep(1000);
    }

    async ModLoadOrdering(operation: Operation, callbacks: SubOperationCallbackSet,
                          workFunctionProgressCallback : WorkFunctionProgressCallback,
                         ...args) {
        await sleep(1000);
        for (let mod of fakeModList) {
            const modInjectionFunc = async (operation: Operation, callbacks: SubOperationCallbackSet,
                                            workFunctionProgressCallback : WorkFunctionProgressCallback) => {
                await sleep(5000);
            };

            this.injectionPlanningOperation.createSubOperation(mod, modInjectionFunc,
                5,5,{
                groupName:"planInjections"
            });
        }
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
        await sleep(1000);
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
            await sleep(1000);
        }

        async InjectionBindingOrdering(operation: Operation, callbacks: SubOperationCallbackSet,
                                       workFunctionProgressCallback : WorkFunctionProgressCallback,
                                          ...args) {
            const bigBindingFunc = async (operation: Operation, callbacks: SubOperationCallbackSet,
                                          workFunctionProgressCallback : WorkFunctionProgressCallback) => {
                for (let i = 0; i < 6000; i++) {
                    if (i%10 == 0) {
                        await workFunctionProgressCallback(i/6000);
                    }
                    await sleep(10);
                }
            };
            this.bindingGenerationOperation.createSubOperation("Hydra", bigBindingFunc,
                5,5,{
                groupName:"generateBindings"
            });

            for (let mod of fakeModList) {
                const modBindingFunc = async (operation: Operation, callbacks: SubOperationCallbackSet,
                                              workFunctionProgressCallback: WorkFunctionProgressCallback) => {
                    await sleep(5000);
                };
                this.bindingGenerationOperation.createSubOperation(mod, modBindingFunc,
                    5,5,{
                    groupName:"generateBindings"
                });
            }
            await sleep(1000);
        }

        async InjectionBindingGeneration(operation: Operation, callbacks: SubOperationCallbackSet,
                                         workFunctionProgressCallback : WorkFunctionProgressCallback,
                                          ...args) {
            console.log(callbacks);
            await callbacks.generateBindings();
        }

        async InjectionPlanning(operation: Operation, callbacks: SubOperationCallbackSet,
                                workFunctionProgressCallback : WorkFunctionProgressCallback,
                                  ...args) {
            await callbacks.planInjections();
        }

        async InjectionApplication(operation: Operation, callbacks: SubOperationCallbackSet,
                                   workFunctionProgressCallback : WorkFunctionProgressCallback,
                                ...args) {
            await sleep(10000);
        }

        async ModdedSourceGeneration(operation: Operation, callbacks: SubOperationCallbackSet,
                                     workFunctionProgressCallback : WorkFunctionProgressCallback,
                                 ...args) {
            await sleep(10000);
        }

    async LoadModifiedSources(operation: Operation, callbacks: SubOperationCallbackSet,
                              workFunctionProgressCallback : WorkFunctionProgressCallback,
                                 ...args) {
        await sleep(10000);
    }

    async ModPreInitialization(operation: Operation, callbacks: SubOperationCallbackSet,
                               workFunctionProgressCallback : WorkFunctionProgressCallback,
                             ...args) {
        await sleep(1000);
    }

    async APISetup(operation: Operation, callbacks: SubOperationCallbackSet,
                   workFunctionProgressCallback : WorkFunctionProgressCallback,
                               ...args) {
        await sleep(1000);
        await callbacks.APIAcquisition();
        await callbacks.APILoadOrdering();
        await callbacks.APILoading();
    }

        async APIAcquisition(operation: Operation, callbacks: SubOperationCallbackSet,
                             workFunctionProgressCallback : WorkFunctionProgressCallback,
                       ...args) {
            await sleep(1000);
        }

        async APILoadOrdering(operation: Operation, callbacks: SubOperationCallbackSet,
                              workFunctionProgressCallback : WorkFunctionProgressCallback,
                             ...args) {
            await sleep(1000);
        }

        async APILoading(operation: Operation, callbacks: SubOperationCallbackSet,
                         workFunctionProgressCallback : WorkFunctionProgressCallback,
                              ...args) {
            await sleep(1000);
        }

    async FinalInitialization(operation: Operation, callbacks: SubOperationCallbackSet,
                              workFunctionProgressCallback : WorkFunctionProgressCallback,
                          ...args) {
        await sleep(1000);
    }
}


main();