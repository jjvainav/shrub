# Service Collection

A simple dependency injection container that supports constructor injection.

## Example

### 1. Define and Create Service

```typescript
export interface IFooService {
    getFoo(): string;
}

export const IFooService = createService<IFooService>("foo-service");

export class FooService implements IFooService {
    getFoo(): string {
        return "foo";
    }
}
```

### 2. Configure Service Collection

The ServiceMap used in the example below implements the IServiceCollection and IServiceRegistration interfaces. The IServiceCollection provides a read-only contract for getting registered services and is also a service itself so it can be injected into a class constructor.

```typescript
const services = new ServiceMap();
services.registerTransient(IFooService, FooService);
```

### 3. Get Service

```typescript
services.get(IFooService);
```

## Constructor Injection

The service object created by createService is a decorator and also used for constructor injection.

```typescript
export class FooBar {
    constructor(@IFooService fooService: IFooService) {
    }
}
```

If FooBar were registered as a service (e.g. IFooBarService) then resolving it via the service collection will automatically inject the IFooService (e.g. services.get(IFooBarService)). However, services can also be injected into the constructor of non-registered classes by using the IInstantiationService that is automatically registered with the service collection.

```typescript
services.get(IInstantiationService).createInstance(FooBar);
```

## Scope Decorators

Sometimes it is beneficial to force a particular scope for a service implementation. For example, if the implementation has state and is intended to be used as a singleton.

```typescript
@Singleton
export class FooService implements IFooService {
}

services.register(IFooService, FooService);
```

The 'register' method will detect the services intended scope by looking for one of the Scope decorators.
