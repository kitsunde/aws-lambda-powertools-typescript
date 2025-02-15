import type {
  SSMClient,
  SSMClientConfig,
  GetParameterCommandInput,
  GetParametersByPathCommandInput,
} from '@aws-sdk/client-ssm';
import type {
  GetOptionsInterface,
  GetMultipleOptionsInterface,
  TransformOptions,
} from './BaseProvider';

/**
 * Interface for SSMProvider with clientConfig property.
 *
 * @interface
 * @property {SSMClientConfig} [clientConfig] - Optional configuration to pass during client initialization, e.g. AWS region.
 * @property {never} [awsSdkV3Client] - This property should never be passed.
 */
interface SSMProviderOptionsWithClientConfig {
  clientConfig?: SSMClientConfig;
  awsSdkV3Client?: never;
}

/**
 * Interface for SSMProvider with awsSdkV3Client property.
 *
 * @interface
 * @property {SSMClient} [awsSdkV3Client] - Optional AWS SDK v3 client to pass during SSMProvider class instantiation
 * @property {never} [clientConfig] - This property should never be passed.
 */
interface SSMProviderOptionsWithClientInstance {
  awsSdkV3Client?: SSMClient;
  clientConfig?: never;
}

/**
 * Options for the SSMProvider class constructor.
 *
 * @type SSMProviderOptions
 * @property {SSMClientConfig} [clientConfig] - Optional configuration to pass during client initialization, e.g. AWS region. Mutually exclusive with awsSdkV3Client.
 * @property {SSMClient} [awsSdkV3Client] - Optional AWS SDK v3 client to pass during DynamoDBProvider class instantiation. Mutually exclusive with clientConfig.
 */
type SSMProviderOptions =
  | SSMProviderOptionsWithClientConfig
  | SSMProviderOptionsWithClientInstance;

/**
 * Options for the SSMProvider getMultiple method.
 *
 * @interface SSMGetOptionsInterface
 * @extends {GetOptionsInterface}
 * @property {number} maxAge - Maximum age of the value in the cache, in seconds.
 * @property {boolean} forceFetch - Force fetch the value from the parameter store, ignoring the cache.
 * @property {GetItemCommandInput} [sdkOptions] - Additional options to pass to the AWS SDK v3 client. Supports all options from `GetParameterCommandInput`.
 * @property {TransformOptions} transform - Transform to be applied, can be 'json' or 'binary'.
 * @property {boolean} decrypt - If true, the parameter will be decrypted. Defaults to `false`.
 */
interface SSMGetOptions extends GetOptionsInterface {
  /**
   * If true, the parameter will be decrypted. Defaults to `false`.
   */
  decrypt?: boolean;
  /**
   * Additional options to pass to the AWS SDK v3 client. Supports all options from `GetParameterCommandInput`.
   */
  sdkOptions?: Partial<GetParameterCommandInput>;

  transform?: Exclude<TransformOptions, 'auto'>;
}

interface SSMGetOptionsTransformJson extends SSMGetOptions {
  transform: 'json';
}

interface SSMGetOptionsTransformBinary extends SSMGetOptions {
  transform: 'binary';
}

interface SSMGetOptionsTransformNone extends SSMGetOptions {
  transform?: never;
}

type SSMGetOptionsUnion =
  | SSMGetOptionsTransformJson
  | SSMGetOptionsTransformBinary
  | SSMGetOptionsTransformNone
  | undefined;

/**
 * Generic output type for the SSMProvider get method.
 */
type SSMGetOutput<
  ExplicitUserProvidedType = undefined,
  InferredFromOptionsType = undefined
> = undefined extends ExplicitUserProvidedType
  ? undefined extends InferredFromOptionsType
    ? string
    : InferredFromOptionsType extends
        | SSMGetOptionsTransformNone
        | SSMGetOptionsTransformBinary
    ? string
    : InferredFromOptionsType extends SSMGetOptionsTransformJson
    ? Record<string, unknown>
    : never
  : ExplicitUserProvidedType;

/**
 * Options for the SSMProvider getMultiple method.
 *
 * @interface SSMGetMultipleOptionsInterface
 * @extends {GetMultipleOptionsInterface}
 * @property {number} maxAge - Maximum age of the value in the cache, in seconds.
 * @property {boolean} forceFetch - Force fetch the value from the parameter store, ignoring the cache.
 * @property {GetItemCommandInput} [sdkOptions] - Additional options to pass to the AWS SDK v3 client.
 * @property {TransformOptions} transform - Transform to be applied, can be 'json' or 'binary'.
 * @property {boolean} decrypt - If true, the parameter will be decrypted.
 * @property {boolean} recursive - If true, the parameter will be fetched recursively.
 * @property {boolean} throwOnTransformError - If true, the method will throw an error if the transform fails.
 */
interface SSMGetMultipleOptions extends GetMultipleOptionsInterface {
  /**
   * Additional options to pass to the AWS SDK v3 client. Supports all options from `GetParametersByPathCommandInput`.
   */
  sdkOptions?: Partial<GetParametersByPathCommandInput>;
  /**
   * If true, the parameters will be decrypted. Defaults to `false`.
   */
  decrypt?: boolean;
  /**
   * If true, the parameters will be fetched recursively. Defaults to `false`.
   */
  recursive?: boolean;
  /**
   * If true, the method will throw an error if the transform fails.
   */
  throwOnTransformError?: boolean;
}

interface SSMGetMultipleOptionsTransformJson extends SSMGetMultipleOptions {
  transform: 'json';
}

interface SSMGetMultipleOptionsTransformBinary extends SSMGetMultipleOptions {
  transform: 'binary';
}

interface SSMGetMultipleOptionsTransformAuto extends SSMGetMultipleOptions {
  transform: 'auto';
}

interface SSMGetMultipleOptionsTransformNone extends SSMGetMultipleOptions {
  transform?: never;
}

type SSMGetMultipleOptionsUnion =
  | SSMGetMultipleOptionsTransformJson
  | SSMGetMultipleOptionsTransformBinary
  | SSMGetMultipleOptionsTransformAuto
  | SSMGetMultipleOptionsTransformNone
  | undefined;

/**
 * Generic output type for the SSMProvider getMultiple method.
 */
type SSMGetMultipleOutput<
  ExplicitUserProvidedType = undefined,
  InferredFromOptionsType = undefined
> = undefined extends ExplicitUserProvidedType
  ? undefined extends InferredFromOptionsType
    ? Record<string, string>
    : InferredFromOptionsType extends
        | SSMGetMultipleOptionsTransformNone
        | SSMGetMultipleOptionsTransformBinary
    ? Record<string, string>
    : InferredFromOptionsType extends SSMGetMultipleOptionsTransformAuto
    ? Record<string, unknown>
    : InferredFromOptionsType extends SSMGetMultipleOptionsTransformJson
    ? Record<string, Record<string, unknown>>
    : never
  : Record<string, ExplicitUserProvidedType>;

/**
 * Options for the SSMProvider getParametersByName method.
 *
 * @interface SSMGetParametersByNameOptions
 * @property {number} maxAge - Maximum age of the value in the cache, in seconds.
 * @property {TransformOptions} transform - Transform to be applied, can be 'json' or 'binary'.
 * @property {boolean} decrypt - If true, the parameter will be decrypted.
 * @property {boolean} throwOnError - If true, the method will throw an error if one of the parameters cannot be fetched. Otherwise it will aggregate the errors under an _errors key in the response.
 */
interface SSMGetParametersByNameOptions {
  maxAge?: number;
  throwOnError?: boolean;
  decrypt?: boolean;
  transform?: Exclude<TransformOptions, 'auto'>;
}

/**
 * Output type for the SSMProvider splitBatchAndDecryptParameters method.
 */
type SSMSplitBatchAndDecryptParametersOutputType = {
  parametersToFetchInBatch: Record<string, SSMGetParametersByNameOptions>;
  parametersToDecrypt: Record<string, SSMGetParametersByNameOptions>;
};

/**
 * Output type for the SSMProvider getParametersByName method.
 */
interface SSMGetParametersByNameOutputInterface {
  response: Record<string, unknown>;
  errors: string[];
}

/**
 * Output type for the SSMProvider getParametersByNameFromCache method.
 */
type SSMGetParametersByNameFromCacheOutputType = {
  cached: Record<string, string | Record<string, unknown>>;
  toFetch: Record<string, SSMGetParametersByNameOptions>;
};

/**
 * Generic output type for the SSMProvider getParametersByName method.
 */
type SSMGetParametersByNameOutput<InferredFromOptionsType = undefined> =
  undefined extends InferredFromOptionsType
    ? Record<string, unknown> & { _errors?: string[] }
    : Record<string, InferredFromOptionsType> & { _errors?: string[] };

export type {
  SSMProviderOptions,
  SSMGetOptions,
  SSMGetOptionsUnion,
  SSMGetOutput,
  SSMGetMultipleOptions,
  SSMGetMultipleOptionsUnion,
  SSMGetMultipleOutput,
  SSMGetParametersByNameOptions,
  SSMSplitBatchAndDecryptParametersOutputType,
  SSMGetParametersByNameOutputInterface,
  SSMGetParametersByNameFromCacheOutputType,
  SSMGetParametersByNameOutput,
};
