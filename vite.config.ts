// The optional directory lets constrained build machines keep dependencies outside the source tree.
const dependencies = process.env.NYIMAK_NODE_MODULES;
export default {
  base: "./",
  resolve: dependencies
    ? {
        alias: [
          {
            find: /^react-dom(\/.*)?$/,
            replacement: `${dependencies}/react-dom$1`,
          },
          { find: /^react(\/.*)?$/, replacement: `${dependencies}/react$1` },
        ],
      }
    : undefined,
  build: { target: "es2022" },
};
