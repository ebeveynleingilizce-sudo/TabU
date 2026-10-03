const titles={home:'Ana Sayfa',practice:'Tab Çalış',learn:'Tab Öğren',progress:'İlerlemen',editor:'TAB Editörü'};
export function navigate(route){location.hash=route}
export function routeFromHash(){const route=location.hash.replace('#','');return route?(titles[route]?route:'home'):'home'}
export function pageTitle(route){return titles[route]||'Tab Çalış'}
