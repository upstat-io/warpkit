import type { DataKey, MutationState, QueryState, UseQueryOptions } from '@warpkit/data';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;

export type CompletedParams = Assert<Equal<QueryState<string>['dataParams'], Record<string, string> | undefined>>;
export type PendingParams = Assert<Equal<QueryState<string>['pendingParams'], Record<string, string> | undefined>>;
export type HandledMutation = Assert<Equal<ReturnType<MutationState<string>['mutate']>, Promise<string | undefined>>>;
export type ThrowingMutation = Assert<Equal<ReturnType<MutationState<string>['mutateAsync']>, Promise<string>>>;

export function conditionalParams<K extends DataKey>(key: K): UseQueryOptions<K> {
	return { key, params: () => undefined };
}
