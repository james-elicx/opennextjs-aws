/* eslint-disable */
// Copied and modified from node-minify-all-js by Adones Pitogo
// https://github.com/adonespitogo/node-minify-all-js/blob/master/index.js

// @ts-nocheck
import fs from "node:fs/promises";
import path from "node:path";

import minify from "@node-minify/core";
import terser from "@node-minify/terser";

const failed_files = [];
let total_files = 0;
const options = {};

const promiseSeries = async (tasks, initial) => {
  if (!Array.isArray(tasks)) {
    return Promise.reject(
      new TypeError("promise.series only accepts an array of functions"),
    );
  }

  return tasks.reduce((current, next) => {
    return current.then(next);
  }, Promise.resolve(initial));
};

const minifyJS = async (file) => {
  total_files++;
  try {
    await minify({
      compressor: terser,
      input: file,
      output: file,
      options: {
        module: options.module,
        mangle: options.mangle,
        compress: { reduce_vars: false },
      },
    });
  } catch (e) {
    failed_files.push(file);
  }
  //process.stdout.write(".");
};

const minifyJSON = async (file) => {
  try {
    if (options.compress_json || options.packagejson) {
      total_files++;
      const is_package_json = file.indexOf("package.json") > -1;
      const data = await fs.readFile(file, "utf8");
      const json = JSON.parse(data);
      let new_json = {};
      if (options.packagejson && is_package_json) {
        const { name, version, bin, main, binary, engines } = json;
        new_json = { name, version };
        if (bin) new_json.bin = bin;
        if (binary) new_json.binary = binary;
        if (main) new_json.main = main;
        if (engines) new_json.engines = engines;
      } else {
        new_json = json;
      }
      await fs.writeFile(file, JSON.stringify(new_json));
    }
  } catch (e) {}
  //process.stdout.write(".");
};

const walk = async (currentDirPath) => {
  const js_files = [];
  const json_files = [];
  const dirs = [];
  const current_dirs = await fs.readdir(currentDirPath);
  for (const name of current_dirs) {
    const filePath = path.join(currentDirPath, name);
    const stat = await fs.stat(filePath);
    const is_bin = /\.bin$/;
    if (stat.isFile()) {
      if (filePath.substr(-5) === ".json") json_files.push(filePath);
      else if (filePath.substr(-3) === ".js" || options.all_js)
        js_files.push(filePath);
    } else if (stat.isDirectory() && !is_bin.test(filePath)) {
      dirs.push(filePath);
    }
  }
  const js_promise = Promise.all(js_files.map((f) => minifyJS(f)));
  const json_promise = Promise.all(json_files.map((f) => minifyJSON(f)));
  await Promise.all([js_promise, json_promise]);
  await promiseSeries(dirs.map((dir) => () => walk(dir)));
};

export async function minifyAll(dir, opts) {
  Object.assign(options, opts || {});
  //console.log("minify-all-js options:\n", JSON.stringify(options, null, 2));
  await walk(dir);
  //process.stdout.write(".\n");
  //console.log("Total found files: " + total_files);
  if (failed_files.length) {
    console.log("\n\nFailed to minify files:");
    failed_files.forEach((f) => console.log(`\t${f}`));
  }
}
