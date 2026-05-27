export function applyUtilityTheme(utility = {}) {
  const primary = utility.primary_color || '#06b6d4';
  const secondary = utility.secondary_color || '#1a4b66';

  document.documentElement.style.setProperty('--primary', primary);
  document.documentElement.style.setProperty('--primary-dark', secondary);
  document.documentElement.style.setProperty('--accent', primary);

  document.documentElement.style.setProperty('--ofori-cyan', primary);
  document.documentElement.style.setProperty('--ofori-blue', primary);
  document.documentElement.style.setProperty('--ofori-steel', secondary);
}