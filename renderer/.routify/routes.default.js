

export const routes = {
  "meta": {},
  "id": "_default",
  "name": "",
  "file": {
    "path": "src/routes",
    "dir": "src",
    "base": "routes",
    "ext": "",
    "name": "routes"
  },
  "rootName": "default",
  "routifyDir": import.meta.url,
  "children": [
    {
      "meta": {
        "isDefault": true
      },
      "id": "_default_index_svelte",
      "name": "index",
      "file": {
        "path": "src/routes/index.svelte",
        "dir": "src/routes",
        "base": "index.svelte",
        "ext": ".svelte",
        "name": "index"
      },
      "asyncModule": () => import('../src/routes/index.svelte'),
      "children": []
    },
    {
      "meta": {},
      "id": "_default_main_menu",
      "name": "main-menu",
      "module": false,
      "file": {
        "path": "src/routes/main-menu",
        "dir": "src/routes",
        "base": "main-menu",
        "ext": "",
        "name": "main-menu"
      },
      "children": [
        {
          "meta": {
            "isDefault": true
          },
          "id": "_default_main_menu_index_svelte",
          "name": "index",
          "file": {
            "path": "src/routes/main-menu/index.svelte",
            "dir": "src/routes/main-menu",
            "base": "index.svelte",
            "ext": ".svelte",
            "name": "index"
          },
          "asyncModule": () => import('../src/routes/main-menu/index.svelte'),
          "children": []
        }
      ]
    },
    {
      "meta": {
        "dynamic": true,
        "dynamicSpread": true,
        "order": false,
        "inline": false
      },
      "name": "[...404]",
      "file": {
        "path": ".routify/components/[...404].svelte",
        "dir": ".routify/components",
        "base": "[...404].svelte",
        "ext": ".svelte",
        "name": "[...404]"
      },
      "asyncModule": () => import('./components/[...404].svelte'),
      "children": []
    }
  ]
}
export default routes