import { JMESPathTypeError, ArityError, VariadicArityError } from '../errors';

/**
 * TODO: write docs for arityCheck()
 *
 * @param args
 * @param argumentsSpecs
 * @param decoratedFuncName
 * @param variadic
 */
const arityCheck = (
  args: unknown[],
  argumentsSpecs: Array<Array<string>>,
  decoratedFuncName: string,
  variadic?: boolean
): void => {
  if (variadic) {
    if (args.length < argumentsSpecs.length) {
      throw new VariadicArityError({
        functionName: decoratedFuncName,
        expectedArity: argumentsSpecs.length,
        actualArity: args.length,
      });
    }
  } else if (args.length !== argumentsSpecs.length) {
    throw new ArityError({
      functionName: decoratedFuncName,
      expectedArity: argumentsSpecs.length,
      actualArity: args.length,
    });
  }
};

/**
 * TODO: write docs for typeCheck()
 * @param args
 * @param argumentsSpecs
 * @param name
 */
const typeCheck = (
  args: unknown[],
  argumentsSpecs: Array<Array<string>>,
  decoratedFuncName: string
): void => {
  argumentsSpecs.forEach((argumentSpec, index) => {
    typeCheckArgument(args[index], argumentSpec, decoratedFuncName);
  });
};

/**
 * TODO: write docs for Functions.#typeCheckArgument()
 *
 * Type checking at runtime involves checking the top level type,
 * and in the case of arrays, potentially checking the types of
 * the elements in the array.
 *
 * @param arg
 * @param argumentSpec
 * @param decoratedFuncName
 */
const typeCheckArgument = (
  arg: unknown,
  argumentSpec: Array<string>,
  decoratedFuncName: string
): void => {
  // TODO: check if all types in argumentSpec are valid
  if (argumentSpec.length === 0 || argumentSpec[0] === 'any') {
    return;
  }
  argumentSpec.forEach((type) => {
    if (type.startsWith('array')) {
      if (!Array.isArray(arg)) {
        throw new JMESPathTypeError({
          functionName: decoratedFuncName,
          currentValue: arg,
          expectedTypes: argumentSpec.join(', '),
          actualType: typeof arg,
        });
      }
      if (type.includes('-')) {
        const arrayItemsType = type.slice(6);
        arg.forEach((element) => {
          typeCheckArgument(element, [arrayItemsType], decoratedFuncName);
        });
      }
    } else {
      if (type === 'string' || type === 'number' || type === 'boolean') {
        if (typeof arg !== type) {
          throw new JMESPathTypeError({
            functionName: decoratedFuncName,
            currentValue: arg,
            expectedTypes: argumentSpec.join(', '),
            actualType: typeof arg,
          });
        }
      } else if (type === 'null') {
        if (!Object.is(arg, null)) {
          throw new JMESPathTypeError({
            functionName: decoratedFuncName,
            currentValue: arg,
            expectedTypes: argumentSpec.join(', '),
            actualType: typeof arg,
          });
        }
      }
    }
  });
};

export { arityCheck, typeCheck };
