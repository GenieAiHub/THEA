---
name: Orval hook query options need explicit queryKey
description: Passing { query: {...} } options to generated Orval hooks fails typecheck without queryKey
---

# Orval generated hooks: query options require queryKey

Passing options to a generated list hook, e.g. `useListX<any>({ query: { refetchInterval: 15000 } })`, fails typecheck with TS2741 "Property 'queryKey' is missing" — the generated `UseQueryOptions` type marks `queryKey` required once you supply any query options.

**How to apply:** always include the generated key getter: `useListX<any>({ query: { queryKey: getListXQueryKey(params), refetchInterval: ... } })`. For param-taking hooks pass the same params object to the key getter so cache keys stay consistent.

Conditional polling works via a function: `refetchInterval: (query) => hasPending(query.state.data) ? 4000 : false`.
