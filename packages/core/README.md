# Description

Shrub is a simple framework for building modular server-side applications and front-end components. The Core package provides a basic API for defining and loading modules.

## Creating a Module

A module can be defined as a class that implements the IModule interface or as a JSON object that satisfies the IModule interface.

```typescript
export class FooModule implements IModule {
    readonly name = "foo";
}
```

```typescript
const fooModule: IModule = {
    name: "foo"
};
```

There are a few methods a module can define that allow it to configure functionality provided by the module and each method is invoked in the following order.

### 1. `initialize(init: IModuleInitializer): void`

Allows a module the ability to perform pre-initialization that needs to happen before any modules or services are configured. Such tasks include binding settings or registering a configuration interface that is exposed to other modules.

### 2. `configureServices(registration: IServiceRegistration): void`

Register services with a service collection.

### 3. `configure(configurator: IModuleConfigurator): void | Promise<void>`

Allows a module to perform additional configuration, such as configure a dependency module. This method supports async operations which can be useful if data needs to be fetched from a remote service during configuration.

## Dependencies

Module depenedencies are specified by defining a `dependencies` property on a module and lifecycle methods get invoked on the dependency before they are invoked on the dependent.

```typescript
export class FooModule implements IModule {
    readonly name = "foo";
    readonly dependencies = [BarModule];
}
```

## Configuration

```typescript
export const IBarModuleConfiguration = createConfig<IBarModuleConfiguration>();
export interface IBarModuleConfiguration {
    registerWidget(widget: IWidget): void;
}

export class BarModule implements IModule {
    readonly name = "bar";

    initialize({ config }: IModuleInitializer): void {
        config(IBarModuleConfiguration).register(() => ({
            registerWidget: widget => {}
        }));
    }
}

export class FooModule implements IModule {
    readonly name = "foo";
    readonly dependencies = [BarModule];

    configure({ config }: IModuleConfigurator): void {
        config.get(IBarModuleConfiguration).registerWidget({});
    }
}
```

## Settings and Options

While Dependency Configuration is a way for one module to configure another at load time. Settings provide a way to provide settings/configuration externally, such as from a config file.

Module Settings are provided as a simple object keyed by a module's name; for example, the below is an example settings object that defines settings for the 'foo' module:

```typescript
const settings = {
    foo: {
        key: value
    }
};
```

A module can access these settings directly from the `configure` method:

```typescript
export class FooModule implements IModule {
    readonly name = "foo";

    configure({ settings }: IModuleConfigurator): void {
        const keyValue = settings.key;
    }
}
```

Sometimes it's useful to pass settings to service instances and this can be done via Service Options.

```typescript
export const IFooOptions = createOptions<IFooOptions>("foo-options");
export interface IFooOptions {
    readonly value: string;
}

export class FooModule implements IModule {
    readonly name = "foo";

    initialize({ settings }: IModuleInitializer): void {
        settings.bindToOptions(IFooOptions);
    }

    configureServices(registration: IServiceRegistration): void {
        registration.registerTransient(IFooService, FooService);
    }
}

export class FooService implements IFooService {
    constructor(@IFooOptions private readonly options: IFooOptions) {
    }
}
```

## Loading Modules

Modules are loaded using the `ModuleLoader` class by simply invoking `ModuleLoader.load`.

```typescript
await ModuleLoader.load([
    FooModule,
    BarModule
]);
```

Note: If a module has any dependencies not specified when calling `ModuleLoader.load` those dependencies will automatically get loaded.

If you want a little more control the module loader provides additional methods for configuring the service collection or settings.

```typescript
await ModuleLoader()
    .useModules([
        FooModule,
        BarModule
    ])
    .useSettings({
        foo: { value: "Hello!" }
    })
    .load();
```
