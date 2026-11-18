export type SingleFlight = (key: string, task: () => Promise<void>) => Promise<void>;

export function singleFlight(): SingleFlight {
	const inFlight = new Set<string>();
	return async (key, task) => {
		if (inFlight.has(key)) return;
		inFlight.add(key);
		try {
			await task();
		} finally {
			inFlight.delete(key);
		}
	};
}
