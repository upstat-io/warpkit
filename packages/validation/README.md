# @warpkit/validation

StandardSchema validation utilities for WarpKit.

## Installation

```bash
npm install @warpkit/validation
```

## Features

- **StandardSchema** - Works with Zod, TypeBox, Valibot, and other compliant validators
- **Type inference** - Full TypeScript support
- **Sync/Async** - Both synchronous and asynchronous validation

## Usage

### Basic Validation

```typescript
import { validate, validateAsync } from '@warpkit/validation';
import { Type } from '@sinclair/typebox';

const UserSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  email: Type.String({ format: 'email' })
});

// Synchronous validation
try {
  const user = validate(UserSchema, data);
  // user is typed as { name: string; email: string }
} catch (e) {
  if (e instanceof ValidationError) {
    console.error(e.issues);
  }
}

// Asynchronous validation (for async schemas)
const user = await validateAsync(UserSchema, data);
```

### Type Definitions

Create named type definitions for registry patterns:

```typescript
import { TypeDefinition, ValidatedType } from '@warpkit/validation';

// Simple type marker (no validation)
const UserType = TypeDefinition.create<User>('user');

// With schema validation
const UserType = ValidatedType.wrap('user', UserSchema);
```

## API

### validate(schema, data)

Synchronously validate data against a StandardSchema. Throws `ValidationError` on failure.

### validateAsync(schema, data)

Asynchronously validate data. Supports both sync and async schemas.

### ValidationError

Error class containing validation issues:

```typescript
class ValidationError extends Error {
  issues: StandardIssue[];
}
```

## StandardSchema Interface

Any schema implementing this interface works with WarpKit:

```typescript
interface StandardSchema<T> {
  '~standard': {
    validate(data: unknown): StandardResult<T> | Promise<StandardResult<T>>;
  };
}
```

## Notes

### TypeBox Limitations

TypeBox requires additional setup for certain validation features:

- **Format validation** (e.g., `email`, `uri`) requires registering format validators via `TypeCompiler` or `ajv`
- **Async validation** is not natively supported by TypeBox's StandardSchema integration

For full format validation support, consider using Zod or Valibot which include built-in format validators.
