# Errata
References to the "Source Code Adapter" are a little obtuse and should be removed.
In practice, these are just a pair of callbacks passed to the WebModLoader instance...

# Scope
The Web Mod-Loader Toolkit (WMLT) aims to enable the creation of generalized and unified mod loading systems for web-games.

It is important to note that the idea, here, is to allow the creation of individual mod loaders for
each game or web service that might be targeted; In other words, there will not be a universal mod loader
that contains all mods for all services the user is interested in. Instead, each player or userbase can
use this package to develop their own customized mod loading solution.

Currently, the only target user is Bonk.io, but hopefully, this module will be adaptable to ANY web service or web game.


# Structure
At the top level, WMLT allows the creation of generic Mod Loaders (instances of WebModLoader).
These Mod Loaders can be created dynamically, or packaged as distinct userscripts or extensions.
Mod Loaders contain the following components, in order of precedence:
* The Source Adapter
* The Mod Registry
  * Mod Providers
    * UserscriptModProvider
    * ExtensionModProvider
    * Theoretically, your own mod provider!
  * Mod Depependency (Versioned)
* The Binding Registry
  * Binding Dependency (Not versioned)
  * Binding Artifact Generation & Debugging Tools
* The API Registry
  * APIs
  * API Dependency (Versioned)
  * Binding Dependencies
  * Do NOT support dependency on mods directly, because in that case, the mod should be a 
  dependency of the mod introducing the API directly. Furthermore, APIs for mods should really be
  built into the mod itself anyways. This is not something I want to direclty support.
* The Operation Manager

## Mod Loaders
Mod Loaders are instances of WebModLoader that have been provided the following:
* A web source adapter
* A ModLoader Name
* A set (possibly empty) of custom mod providers

## Web Source Adapter
The Web Source Adapter must provide two functions:
* getInterceptedSources
* loadModifiedSources

The WebModLoader instance must be able to call `getInterceptedSources` at any time after initialization, and this
function must return the full list of source-codes for the game or web service. This function can be async, and
the WebModLoader instance will await its result.

When the WebModLoader instance is finished loading all mods and compiling all modified source codes,
it will call `loadModifiedSources` with the full list of source codes, along with a finishedLoading callback.
The Web Source Adapter must then load these source codes in place of the original intercepted sources, and
call the finishedLoading callback when these sources have all loaded.

`loadModifiedSources` should be async, and the promise returned should pend until the sources have finished loading.

Also note that the WebModLoader should probably be loaded in the content context
(rather than the background script context), otherwise any APIs introduced will not be accessible at runtime. 


## The Mod Registry
The Mod Registry begins with Mod Providers.
All WebModLoaders have two built-in mod providers: UserScriptModProvider and ExtensionModProvider
Both of these will automatically scan for mods that are installed via a UserScript manager or via Extensions.
This project will provide NPM packages and pre-compiled toolkit scripts for both UserScript mods and Extension
mods to register themselves with a specific modloader via these mechanisms.

The creator of the Mod Loader may also provide their own custom ModProvider, which directly provides instances of
WebMods to WebModLoader. This might be useful, for example, for creating a built-in mod manager for your Mod Loader.

Mods themselves can also register custom Mod Providers during a special stage in the loading procedure.

## The Binding Registry
The Binding registry is a mapping from unique binding names to bindings.

Bindings are either Abstract Syntax Tree nodes which may be used as targets for injection, or they may be
JSON-compatible objects derived during any deobfuscation/automatic analysis processes performed by Mods.

## The API Registry
The API registry is a mapping from unique API names to API objects.

API objects are objects createc by Mods at runtime which typically contain useful functions or values that other
mods may use. APIs cannot be used pre-injection. Instead, Bindings must be used for any pre-injection purposes.

## The Operation Manager
### Description
This section is tentative, because I cannot decide whether this should be done as an object factory, or a registry

The Operation Manager serves two purposes:
* Incrementally monitor and report the progress of mod loading
* Collect structured mod loading artifact data for debugging

This system expects a recursive tree of Loading Operations.
The root loading operation is the WebModLoader init function itself.
Each sub-operation of each loading operation must register itself as such, and offer an estimation (in seconds)
of the amount of time it will take. This allows the creation of an intuitive progress bar during loading if desired.
When finally called, each sub-operation is provided an object it may use to asynchronously report its progress, as well
as submit any loading artifacts.

Loading artifacts are JSON-compatible objects which represent critical information regarding how the loading process
went. Each Loading Operation may register one of four types of artifact:
Error, Source Trace, Operation Trace, Debug, and Info

Error artifacts should only be produced under an error condition, and if any are produced, the Mod Loader author should
somehow alert the user to them.

Trace artifacts are artifacts that usually should not change. The Operation Manager has the ability to detect
changes between loads in these artifacts. If these artifacts change, this may indicate a problem.

There are two types of trace artifacts: Source Trace, and Operation Trace. Operation Trace artifacts are expected to
remain identical as long as the operation that introduced them remains identical, whereas Source Trace artifacts should
not change even if the operation that introduced them changed. Both Trace artifact types are expected not to change
between versions of the source being modified.

For instance, if a user updates their installed version of the Mod Loader, or of one of the mods, it is not considered
problematic for Operation Trace Artifacts introduced by the Mod Loader, or by the mod that was updated to change.
However, the Source Trace Artifacts should remain identical.

Debug artifacts and info artifacts are not checked by the Operation Manager at all, but can be provided by
Load Operations for debugging purposes if they are useful.

Operations may be marked as skipped, in which case any missing trace artifacts will be ignored.

The Operation Manager can either produce the full report, or can produce a filtered report given a list of
desired artifact types.


All artifacts may have an optional parameter: Direct References.
This parameter should ONLY be used for debugging purposes, in situations where it is necessary to acquire references to
in-memory JavaScript objects, such as large objects (AST branches for instance), functions, ETC, which cannot, or would
be prohibitively expensive to represent in JSON.

Using this parameter likely defeats the purpose of the artifact system, since any values stored within it will be lost
when the browser window closes. But certain types of artifacts, especially Debug artifacts, may require them in order
to be useful.


### Motivation
This system is somewhat complex, but is motivated by past experiences during Bonk.io updates.
Working with obfuscated code is difficult, and often-times the "correct" behavior is not obvious from the current source.
The concept of Source and Operation traces is particularly useful for figuring out when obfuscated source bindings
need updating.

# Loading Procedure
## Step 0: Preload
Before anything else, the creator of a Mod Loader must invent a source-code interception system,
and a Source Code Adapter. The interception system should intercept any relevant source code
_**before**_ it is loaded, and hold on to it until the next step. The Source Code Adapter
is just an interface for this source code interception.

## Step 1: Initialization
After the browser has finished loading, the Mod Loader author must create an instance of WebModLoader,
passing it the required properties (listed in [Mod Loaders](#mod-loaders)).

This will trigger initialization. The WebModLoader instance will then perform the next steps:

## Step 2: Mod Acquisition
The first task performed during initialization is Mod Acquisition.
In this step, each registerrd Mod Provider is queried for the mods it can provide.
These query functions may be async, and the WebModLoader will await their result.
Note that Mod Providers do not support a dependency tree; instead, this is done at the mod level.
Each mod returned by each Mod Provider will be added to the Mod Registry.
Each mod returned by each Mod Provider will be briefly queried for further Mod Providers.
Each mod returned by each Mod Provider must provide a unique UUID, for by the caching system.
PLEASE NOTE: Every distinct update of your mod should have a new UUID. Otherwise, caching may fail when users
update your mod.
Any Mod Providers returned will be processed after the already-existing mod providers.
Once all mod providers have been queried (in no particular order), the Web Mod Loader will
proceed to the next step.

# Step 3: Load Order and Cache Determination 
Once all mods have been acquired, a load order must be determined.
A load order satisfying all dependencies specified will be deterministically picked based on the UUIDs provided, so that
if the same set of mods (as in, the same set of mod UUIDs), with the same set of mod dependencies is provided, the
same mod load order will be generated.
Any mods whose dependencies could not be established (perhaps due to a dependency loop) will not be loaded, and a
dependency error artifact will be generated for them.

After the mod load order has been established, all of the mod UUIDs will be appended in their load order, and hashed.
The result of this hash will be known as the Mod Stack Hash, and will be stored for later use.

# Step 4: Injection or Cache Load
Either Cache Load or Injection Load will be selected depending on whether the Mod Stack Hash matches the Mod Stack Hash
seen on the previous load cycle.

## Step 4.a Cache Load
If the Mod Stack Hash matches its previous value, loadModifiedSources will be called in this step with a cached copy
of the Modded Source.

## Step 4.b Injection Load
If the Mod Stack Hash does not match its previous value, or there is no previous value, or the Web Mod Loader is in
debug mode, then the Cached Modded Source will be disregarded, and a new Modded Source will be generated. This is
known as injection loading.

### Injection Loading Theory of Operation
Injection Loading is based on Abstract Syntax Tree analysis. The full source code of the modding target is parsed, 
and an Abstract Syntax Tree representation of it is generated.

Mods may then create what are known as "Bindings", which are simply named references either to AST nodes,
or, alternatively, to JSON-compatible values (such as strings or arrays of strings). Binding names must be unique.

Finally, Mods may request various forms of injection which target AST-type bindings.

The available injection types are detailed in the next section.

### Injection Loading Procedure

The Injection Loading consists of the following steps:

## Step 4.b.1 Binding Acquisition
All mods are queried (in the mod load order) for the names of the bindings they are capable of providing, as well as the
names of the bindings those bindings depend on.

Binding names MUST be unique. In the event of a naming collision, the FIRST definition given for a binding
will win, and an error artifact will be generated.

## Step 4.b.2 Binding Generation Order Determination
A binding generation order is determined satisfying the requested dependencies. Bindings whose dependencies could not 
be satisfied will not be generated. This load order is deterministic based on the names of the bindings.
(Changing binding names may alter the binding load order in the event of dependency ambiguity).

## Step 4.b.2 Binding Generation
The Mods are now queried (by name), in the Binding Load Order, for the bindings they are capable of providing.
The bindings that were requested as dependencies will be passed as part of the query.

## Step 4.b.3 Injection Planning
Each of the loaded mods are now queried (in the mod load order) for their injections.
Injection Requests will NOT be applied immediately, but rather will be applied in the order in which they were
requested.

Injection Requests come in the following forms, designed to ensure that no injection request is likely to interfere
with another, even if both injection requests target the same AST node:

* Explicit Injection Requests

  These are the most basic type of injection request, and the most likely to fail. Mod developers should probably
  not use these. They consist of a target parent node, an injection index, and an injection AST tree/tree list or 
  source code. The source code or AST tree(s) will be inserted directly into the targeted parent at the index requested.
  Because an explicit index is used, this may result in multi-tree or source-code injections being blended.
* Adjacent Injection Requests

  Adjacent Injection Requests accept a target node, an adjacency type (before vs. after), and an injection AST tree/tree
  list or source code. This type of injection request attempts to insert the injection source either immediately before
  or immediately after the target node, within the same block said target node lives within.
  
  During injection, Adjacent Injection Requests are converted into Explicit Injection Requests automatically.
* Function Wrapper Injection Requests 
  Function Wrapper Injection requests may target any function, or function-like entity, as well as a wrapper callback
  (source code or AST tree). Whenever said entity is called, the wrapper callback will be called with all passed in
  arguments instead, as well as a reference to the original function. If multiple function wrapper requests are made
  targeting the same function-like entity, each successive wrapper will wrap the previously applied wrapper in such
  a way that the outer wrapper need not pass the original function to the inner wrapper (this will be done
  automatically).
  Wrapper functions are actually injected INSIDE the function they wrap, and are injected as arrow functions.
  An arrow function which contains the original source is also created along-side the wrapper function, and this is
  what is ultimately passed to the wrapper function.
* Statement Wrapper Requests
  Statement Wrapper Requests may target any statement or callable sub-statement. The statement or sub-statement will
  be passed as an arrow function to a wrapper function (provided by the request), which the wrapper function must call.
  The wrapper function may then return a value, which will be used in place of the original statement which was wrapped.

## Step 4.b.4 Injection
Once all of the Injection Requests have been received, Injection occurs.
Injection is the process of actually applying Injection Requests.
All Injection Requests will be applied in the order in which they were received.
The result is a modified Abstract Syntax Tree that represents the eventual Modded Source Code.

In debug mode, or if a particular injection request explicitly requested it, the WebModLoader will create a snapshot of
the AST branch containing the injection target before and after injection. These snapshots will be
actual JavaScript source code generated from the AST states. These snapshots will be recorded as Debug artifacts,
and will also be associated with the Mod that generated them.

## Step 4.b.5 Modded Source Generation
Once Injection is complete, the Abstract Syntax Tree is re-synthesized into JavaScript source code, known as the Modded Source.

## Step 4.b.6 Caching and Modded Source Loading
Finally, the Modded Source is cached (along with the Mod Stack Hash), and the Modded Source is provided to loadModifiedSources.

# Step 5: Mod Pre-Initialization
After the promise returned by loadModifiedSource has resolved, the WebModLoader instance will, pre-initialize all
of the mods. This is simply a parameterless callback called on all mods in the Mod Load Order.

Mods should use this callback for any kind of pre-initialization they need to do, but please note that APIs are not
available at this stage.

# Step 6: API acquisition
Mods are now queried for the names and versions of the APIs they can provide, as well as the names and API versions
those APIs rely on.

# Step 7: API Load Order Determination
A load order for APIs is established that satisfies the requested dependency tree. This load order is deterministic with
respect to the names provided the APIs. Any APIs for whom all the requirements could not be satisfied will not be loaded,
and an error artifact will be generated.

#Step 8: API Loading
Each mod is queried (by name) for each of the APIs it provides. The mod should return any object, ideally containing
functions that can be called as part of the API. The API objects corresponding to the APIs listed in the dependencies
during API acquisition are provided with each API query. APIs are also directly accessible via
`WebModLoaderInstance.APIs["APIName"]`.

#Step 9: Mod Final Initialization
In this last step, each mod is asked to finalize its initialization. By this point, all APIs are available (and any
that were requested will be provided to the final initialization callback), and mods may proceed to perform any final
startup tasks they wish to perform. From here, it is up to the Mods to do what they please with the APIs they have
been provided. Mod Final Initialization does count as an Operation according to the Operation Manager, so mods will need
to provide a time expense estimation for this call.

# Planned NPM Packages
* WebModLoaderToolkit
* WebModLoaderToolkitUserscriptModTools
* WebModLoaderToolkitExtensionModTools
* HydraExecutionAnalyzer

# Key Sub-Components Not Detailed Here
* Generalized Dependency System?
* Hydra Execution Analyzer
* Bonk Mod Loader (more on this later)
  * BonkModLoaderBuiltinModProvider
    * BonkRegexBindingProviderMod
    * BonkHydraBindingProviderMod
    * BonkAPIMod
      * GameModeAPI