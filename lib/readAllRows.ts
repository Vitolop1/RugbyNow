// The caller must use a stable, unique ordering for pagination.
export async function readAllRows<T>(readPage: (offset: number, size: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  const size = 1000;
  for (let offset = 0; ; offset += size) {
    const { data, error } = await readPage(offset, size);
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Snapshot query returned no data.");
    rows.push(...data);
    if (data.length < size) return rows;
  }
}
