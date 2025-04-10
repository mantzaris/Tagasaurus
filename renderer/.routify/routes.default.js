

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
      "id": "_default_streaming",
      "name": "streaming",
      "module": false,
      "file": {
        "path": "src/routes/streaming",
        "dir": "src/routes",
        "base": "streaming",
        "ext": "",
        "name": "streaming"
      },
      "children": []
    },
    {
      "meta": {},
      "id": "_default_tagging",
      "name": "tagging",
      "module": false,
      "file": {
        "path": "src/routes/tagging",
        "dir": "src/routes",
        "base": "tagging",
        "ext": "",
        "name": "tagging"
      },
      "children": [
        {
          "meta": {
            "dynamic": true,
            "order": false
          },
          "id": "_default_tagging__slug__svelte",
          "name": "[slug]",
          "file": {
            "path": "src/routes/tagging/[slug].svelte",
            "dir": "src/routes/tagging",
            "base": "[slug].svelte",
            "ext": ".svelte",
            "name": "[slug]"
          },
          "asyncModule": () => import('../src/routes/tagging/[slug].svelte'),
          "children": []
        },
        {
          "meta": {
            "isDefault": true
          },
          "id": "_default_tagging_index_svelte",
          "name": "index",
          "file": {
            "path": "src/routes/tagging/index.svelte",
            "dir": "src/routes/tagging",
            "base": "index.svelte",
            "ext": ".svelte",
            "name": "index"
          },
          "asyncModule": () => import('../src/routes/tagging/index.svelte'),
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