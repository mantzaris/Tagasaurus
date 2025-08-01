// @ts-nocheck


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
      "meta": {},
      "id": "_default_face_explore",
      "name": "face-explore",
      "module": false,
      "file": {
        "path": "src/routes/face-explore",
        "dir": "src/routes",
        "base": "face-explore",
        "ext": "",
        "name": "face-explore"
      },
      "children": [
        {
          "meta": {
            "isDefault": true
          },
          "id": "_default_face_explore_index_svelte",
          "name": "index",
          "file": {
            "path": "src/routes/face-explore/index.svelte",
            "dir": "src/routes/face-explore",
            "base": "index.svelte",
            "ext": ".svelte",
            "name": "index"
          },
          "asyncModule": () => import('../src/routes/face-explore/index.svelte'),
          "children": []
        }
      ]
    },
    {
      "meta": {},
      "id": "_default_import_export",
      "name": "import-export",
      "module": false,
      "file": {
        "path": "src/routes/import-export",
        "dir": "src/routes",
        "base": "import-export",
        "ext": "",
        "name": "import-export"
      },
      "children": [
        {
          "meta": {
            "isDefault": true
          },
          "id": "_default_import_export_index_svelte",
          "name": "index",
          "file": {
            "path": "src/routes/import-export/index.svelte",
            "dir": "src/routes/import-export",
            "base": "index.svelte",
            "ext": ".svelte",
            "name": "index"
          },
          "asyncModule": () => import('../src/routes/import-export/index.svelte'),
          "children": []
        }
      ]
    },
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
      "children": [
        {
          "meta": {
            "isDefault": true
          },
          "id": "_default_streaming_index_svelte",
          "name": "index",
          "file": {
            "path": "src/routes/streaming/index.svelte",
            "dir": "src/routes/streaming",
            "base": "index.svelte",
            "ext": ".svelte",
            "name": "index"
          },
          "asyncModule": () => import('../src/routes/streaming/index.svelte'),
          "children": []
        }
      ]
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
      "meta": {},
      "id": "_default_user_settings",
      "name": "user-settings",
      "module": false,
      "file": {
        "path": "src/routes/user-settings",
        "dir": "src/routes",
        "base": "user-settings",
        "ext": "",
        "name": "user-settings"
      },
      "children": [
        {
          "meta": {
            "isDefault": true
          },
          "id": "_default_user_settings_index_svelte",
          "name": "index",
          "file": {
            "path": "src/routes/user-settings/index.svelte",
            "dir": "src/routes/user-settings",
            "base": "index.svelte",
            "ext": ".svelte",
            "name": "index"
          },
          "asyncModule": () => import('../src/routes/user-settings/index.svelte'),
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