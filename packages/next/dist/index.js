import{applySkyloupeWebpack as r}from"@skyloupe/webpack";function a(t={}){return{...t,webpack(o,e){let n=t.webpack?.(o,e)??o;return e.dev&&r(n,{dev:!0,root:e.dir}),n}}}export{a as withSkyloupe};
