

export const freshImport = $state({
  value: false,
});


export function assignFreshImport(val: boolean) {
  freshImport.value = val
}