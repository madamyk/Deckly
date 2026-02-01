export function pLimit(concurrency: number) {
  if (!(concurrency > 0)) throw new Error('concurrency must be > 0');
  let activeCount = 0;
  const queue: { fn: () => Promise<any>; resolve: (v: any) => void; reject: (e: any) => void }[] =
    [];

  const next = () => {
    if (activeCount >= concurrency) return;
    const item = queue.shift();
    if (!item) return;
    activeCount++;
    Promise.resolve()
      .then(item.fn)
      .then(item.resolve, item.reject)
      .finally(() => {
        activeCount--;
        next();
      });
  };

  return function <T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
  };
}

