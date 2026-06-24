export function clientePath(cliente: string): string {
  return `/clientes/${encodeURIComponent(cliente)}`;
}

export function specPath(specId: number | string): string {
  return `/specs/${specId}`;
}

export function decodeRouteParam(value: string | undefined): string {
  return value ? decodeURIComponent(value) : '';
}
