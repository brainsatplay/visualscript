var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// src/registry.js
var registry_default = {
  "gz": "application/x-gzip",
  "csv": "text/comma-separated-values",
  "tsv": "text/tab-separated-values",
  "json": "application/json",
  "nii": "application/x-nii",
  "edf": "application/x-edf",
  "nwb": "application/x-nwb"
};

// src/getInfo.js
var getInfo = (file2) => {
  let [name, ...extension5] = (file2.name ?? "").split(".");
  let mimeType5 = file2.type;
  const zipped = mimeType5 === registry_default["gz"] || extension5.includes("gz");
  if (zipped)
    extension5.pop();
  if (zipped || !mimeType5)
    mimeType5 = registry_default[extension5[0]];
  return { mimeType: mimeType5, zipped, extension: extension5.join(".") };
};
var getInfo_default = getInfo;

// src/utils/classes.js
function isClass(obj) {
  const isCtorClass = obj.constructor && obj.constructor.toString().substring(0, 5) === "class";
  if (obj.prototype === void 0) {
    return isCtorClass;
  }
  const isPrototypeCtorClass = obj.prototype.constructor && obj.prototype.constructor.toString && obj.prototype.constructor.toString().substring(0, 5) === "class";
  return isCtorClass || isPrototypeCtorClass;
}

// src/request.js
var request_default = async (url, options, progressCallback) => {
  const response = await fetch(url, options).catch(() => {
  });
  return new Promise((resolve) => {
    if (response) {
      const reader = response.body.getReader();
      const bytes = parseInt(response.headers.get("Content-Length"), 10);
      const type = response.headers.get("Content-Type");
      let bytesReceived = 0;
      let buffer = [];
      const processBuffer = async ({ done, value }) => {
        if (done) {
          const config = {};
          if (typeof type === "string")
            config.type = type;
          const blob = new Blob(buffer, config);
          const ab = await blob.arrayBuffer();
          resolve(new Int8Array(ab));
          return;
        }
        bytesReceived += value.length;
        const chunk = value;
        buffer.push(chunk);
        if (progressCallback instanceof Function)
          progressCallback(options?.headers?.Range, bytesReceived / bytes, bytes);
        return reader.read().then(processBuffer);
      };
      reader.read().then(processBuffer);
    } else {
      console.warn("Response not received!", options.headers);
      resolve(new Uint8Array());
    }
  });
};

// src/RangeFile.js
var useRawArrayBuffer = ["nii", "nwb"];
var RangeFile = class {
  constructor(file2, options = {}) {
    __publicField(this, "createFile", async (buffer, oldFile = this.file, createInSystem = false) => {
      let newFile = new Blob([buffer], oldFile);
      newFile.lastModified = oldFile.lastModified;
      newFile.lastModifiedDate = oldFile.lastModifiedDate;
      newFile.name = oldFile.name;
      newFile.webkitRelativePath = oldFile.webkitRelativePath || `${this.directory}/${this.path || this.name}`;
      if (createInSystem && !this.fileSystemHandle)
        this.fileSystemHandle = await this.parent.getFileHandle(this.name, { create: true });
      return newFile;
    });
    __publicField(this, "loadFileInfo", (file2) => {
      this.name = file2.name;
      this.type = file2.type;
      const { mimeType: mimeType5, zipped, extension: extension5 } = getInfo_default(file2);
      this.mimeType = mimeType5;
      this.zipped = zipped;
      this.extension = extension5;
    });
    __publicField(this, "init", async () => {
      if (this.fileSystemHandle === this.file) {
        this.file = await this.fileSystemHandle.getFile();
        this.loadFileInfo(this.file);
      }
      if (this.method === "local") {
        let converted = false;
        if (!(this.file instanceof Blob)) {
          this.set(this.file.data);
          await this.sync();
          converted = true;
        }
        this.storage = await this.getFileData().catch(this.onError);
        if (!converted) {
          if (this.storage)
            this.file = await this.createFile(this.storage.buffer);
          else
            console.warn(`No buffer created for ${this.name}...`);
        }
      }
      this.config = this.manager.extensions?.[this.mimeType]?.config;
      await this.setupByteGetters();
    });
    __publicField(this, "setOriginal", () => {
      const tic = performance.now();
      if (isClass(this["#body"])) {
        this[`#original`] = null;
        console.warn("Will not deep clone file bodies that are class instances");
      } else if (this.config) {
        this[`#original`] = null;
        console.warn("Will not stringify bodies that support range requests.");
      } else {
        try {
          this[`#original`] = JSON.parse(JSON.stringify(this[`#body`]));
        } catch (e) {
          this[`#original`] = null;
          console.warn("Could not deep clone", e);
        }
      }
      const toc = performance.now();
      if (this.debug)
        console.warn(`Time to Deep Clone (${this.name}): ${toc - tic}ms`);
    });
    __publicField(this, "get", async () => {
      try {
        if (!this[`#body`]) {
          const ticDecode = performance.now();
          this[`#body`] = await this.manager.decode(this.storage, this.file).catch(this.onError);
          const tocDecode = performance.now();
          if (this.debug)
            console.warn(`Time to Decode (${this.name}): ${tocDecode - ticDecode}ms`);
        }
        if (this["#original"] === void 0)
          this.setOriginal();
        return this[`#body`];
      } catch (e) {
        const msg = `Decoder failed for ${this.name} - ${this.type || "No file type recognized"}`;
        console.warn(msg, e);
        return {};
      }
    });
    __publicField(this, "set", (o2) => this[`#body`] = o2);
    __publicField(this, "sync", async (createInSystem) => {
      if (!this.config) {
        const bodyString = JSON.stringify(this[`#body`]);
        const ogString = JSON.stringify(this[`#original`]);
        if (bodyString !== ogString) {
          console.warn(`Synching file contents with buffer (${this.name})`, `${ogString} > ${bodyString}`);
          try {
            const ticEncode = performance.now();
            this.storage.buffer = await this.manager.encode(this[`#body`], this.file).catch(this.onError);
            const tocEncode = performance.now();
            if (this.debug)
              console.warn(`Time to Encode (${this.name}): ${tocEncode - ticEncode}ms`);
          } catch (e) {
            console.error("Could not encode as a buffer", o, this.mimeType, this.zipped);
            this.onError(e);
          }
          this.file = await this.createFile(this.storage.buffer, this.file, createInSystem);
          this.setOriginal();
          return this.file;
        } else
          return true;
      } else {
        console.warn(`Write access is disabled for RangeFile with range-gettable properties (${this.name})`);
        return true;
      }
    });
    __publicField(this, "save", async () => {
      const file2 = await this.sync(true);
      if (file2 instanceof Blob) {
        if (this.fileSystemHandle.size == file2.size)
          return;
        const writable = await this.fileSystemHandle.createWritable();
        const stream = file2.stream();
        const tic = performance.now();
        await stream.pipeTo(writable);
        const toc = performance.now();
        if (this.debug)
          console.warn(`Time to stream into file (${this.name}): ${toc - tic}ms`);
      }
    });
    __publicField(this, "onError", (e) => {
      console.error(e);
    });
    __publicField(this, "getFromBytes", async (key, property = this.config.properties[key], parent, i) => {
      if (property) {
        let start = await this.getProperty(property.start, parent, i);
        const length = await this.getProperty(property.length, parent, i);
        let bytes = [];
        if (this.method === "remote")
          bytes = await this.getRemote({ key, start, length }).catch(console.error);
        else {
          let tempBytes = [];
          if (!Array.isArray(start))
            start = [start];
          start.forEach((i2) => tempBytes.push(this.storage.buffer.slice(i2, i2 + length)));
          const totalLen = tempBytes.reduce((a, b) => a + b.length, 0);
          const tic2 = performance.now();
          let offset = 0;
          bytes = new Uint8Array(totalLen);
          tempBytes.forEach((arr) => {
            bytes.set(arr, offset);
            offset += arr.length;
          });
          const toc2 = performance.now();
          if (this.debug && start.length > 1)
            console.warn(`Time to merge arrays (${this.name}): ${toc2 - tic2}ms`);
        }
        const tic = performance.now();
        let output = property.ignoreGlobalPostprocess ? bytes : this.config.preprocess(bytes);
        if (property.postprocess instanceof Function)
          output = await property.postprocess(output, this["#body"], i);
        const toc = performance.now();
        if (this.debug)
          console.warn(`Time to postprocess bytes (${this.name}): ${toc - tic}ms`);
        return output;
      } else {
        console.warn(`No getter for ${key}`);
      }
    });
    __publicField(this, "getProperty", async (property, parent, i) => {
      if (property instanceof Function) {
        try {
          return property(this["#body"], parent, i).catch((e) => console.error(e));
        } catch {
          return property(this["#body"], parent, i);
        }
      } else
        return property;
    });
    __publicField(this, "defineProperty", async (key, property, parent, i) => {
      if ("start" in property && property.length) {
        Object.defineProperties(parent, {
          [key]: {
            enumerable: true,
            get: () => {
              if (!parent[`#${key}`])
                parent[`#${key}`] = this.getFromBytes(key, property, parent, i);
              return parent[`#${key}`];
            }
          },
          [`#${key}`]: {
            writable: true,
            enumerable: false
          }
        });
      } else if (property.n && property.properties) {
        this["#body"][key] = [];
        const n = await this.getProperty(property.n, property);
        for (let i2 = 0; i2 < n; i2++) {
          const value = {};
          Object.defineProperty(value, "n", { get: () => n });
          for (let prop in property.properties) {
            await this.defineProperty(prop, property.properties[prop], value, i2);
          }
          this["#body"][key].push(value);
        }
      }
    });
    __publicField(this, "setupByteGetters", async () => {
      Object.defineProperties(this, {
        ["body"]: {
          enumerable: true,
          get: async () => this.get(),
          set: (o2) => this.set(o2)
        },
        [`#body`]: {
          writable: true,
          enumerable: false
        }
      });
      if (this.config) {
        this[`#body`] = {};
        for (let key in this.config.properties)
          await this.defineProperty(key, this.config.properties[key], this["#body"]);
        if (this.config.metadata instanceof Function)
          await this.config.metadata(this["#body"], this.config);
      }
    });
    __publicField(this, "request", request_default);
    __publicField(this, "getRemote", async (property) => {
      let { start, length } = property;
      const options = Object.assign({}, this.options);
      if (!Array.isArray(start))
        start = [start];
      if (start.length < 1)
        return new Int8Array();
      else {
        let Range = `bytes=${start.map((val) => `${length ? `${val}-${val + length - 1}` : val}`).join(", ")}`;
        const maxHeaderLength = 15e3;
        if (Range.length > maxHeaderLength) {
          const splitRange = Range.slice(0, maxHeaderLength).split(", ");
          console.warn(`Only sending ${splitRange.length - 1} from ${start.length} range requests to remain under the --max-http-header-size=${1600} limit`);
          Range = splitRange.slice(0, splitRange.length - 1).join(", ");
        }
        options.headers = Object.assign({ Range }, options.headers);
        const buffer = await request_default(`${this.remote.origin}/${this.file.path}`, options);
        return buffer;
      }
    });
    __publicField(this, "getFileData", () => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const methods = {
          "dataurl": "readAsDataURL",
          "buffer": "readAsArrayBuffer"
        };
        let method = "buffer";
        if (this.file.type && (this.file.type.includes("image/") || this.file.type.includes("video/")))
          method = "dataurl";
        reader.onloadend = (e) => {
          if (e.target.readyState == FileReader.DONE) {
            if (!e.target.result)
              return reject(`No result returned using the ${method} method on ${this.file.name}`);
            let data = e.target.result;
            if (data.length === 0) {
              console.warn(`${this.file.name} appears to be empty`);
              reject(false);
            } else if (method === "buffer" && !useRawArrayBuffer.includes(this.extension))
              data = new Uint8Array(data);
            resolve({ file: this.file, [method]: data });
          }
        };
        reader[methods[method]](this.file);
      });
    });
    if (file2 instanceof FileSystemFileHandle)
      this.fileSystemHandle = file2;
    if (options.parent)
      this.parent = options.parent;
    this.file = file2;
    this.debug = options.debug;
    this.manager = options.manager;
    this.directory = options.directory ?? "";
    this.path = options.path;
    this.method = file2.origin && file2.path ? "remote" : "local";
    if (this.method === "remote") {
      this.remote = file2;
      const split = file2.path.split("/");
      file2.name = split[split.length - 1];
      this.options = file2.options;
      this.type = null;
    }
    this.loadFileInfo(this.file);
    this.storage = {};
    this[`#original`] = void 0;
  }
};

// src/defaults/text.js
var text_exports = {};
__export(text_exports, {
  decode: () => decode,
  encode: () => encode,
  extension: () => extension,
  mimeType: () => mimeType
});
var mimeType = "text/plain";
var extension = "txt";
var encode = (o2) => new TextEncoder().encode(o2 ? o2.toString() : "");
var decode = (o2) => new TextDecoder().decode(o2.buffer);

// src/defaults/gzip.js
var decode2 = (o2) => {
  return new Promise((resolve, reject) => {
    try {
      o2.buffer = pako.inflate(o2.buffer).buffer;
      resolve(o2);
    } catch (e) {
      console.error(e);
      return reject(false);
    }
  });
};
var encode2 = (o2) => pako.deflate(o2);

// src/defaults/json.js
var json_exports = {};
__export(json_exports, {
  decode: () => decode3,
  encode: () => encode3,
  extension: () => extension2,
  mimeType: () => mimeType2
});
var mimeType2 = "application/json";
var extension2 = "json";
var encode3 = (o2) => encode(JSON.stringify(o2));
var decode3 = (o2) => JSON.parse(!o2.text ? decode(o2) : o2.text);

// src/defaults/tsv.js
var tsv_exports = {};
__export(tsv_exports, {
  decode: () => decode5,
  encode: () => encode5,
  extension: () => extension4,
  mimeType: () => mimeType4
});

// src/defaults/csv.js
var csv_exports = {};
__export(csv_exports, {
  decode: () => decode4,
  encode: () => encode4,
  extension: () => extension3,
  mimeType: () => mimeType3
});
var stripBOM = (str) => str.replace(/^\uFEFF/, "");
var normalizeEOL = (str) => str.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
var isContentfulRow = (row) => row && !/^\s*$/.test(row);
var addBOM = (str) => `\uFEFF${str}`;
var extension3 = "csv";
var mimeType3 = "text/csv";
var encode4 = (arr, separator) => {
  const rows = arr.length ? [Object.keys(arr[0]), ...arr.map((o2) => Object.values(o2))] : [];
  let content2 = rows.map((row) => row.join(separator)).join("\n");
  content2 = addBOM(content2);
  return new TextEncoder().encode(content2);
};
var decode4 = (o2, separator = ",") => {
  if (!o2.text)
    o2.text = new TextDecoder().decode(o2.buffer);
  let contents = o2.text;
  const collection = [];
  contents = stripBOM(contents);
  const rows = normalizeEOL(contents).split("\n").filter(isContentfulRow).map((str) => str.split(separator));
  const headers = rows.length ? rows.splice(0, 1)[0] : [];
  rows.forEach((arr, i) => {
    let strObject = `{`;
    arr.forEach((val, j) => strObject += `"${headers[j]}":${val}`);
    strObject += "}";
    collection.push(strObject);
  });
  return collection.map((str) => JSON.parse(str));
};

// src/defaults/tsv.js
var mimeType4 = "text/tab-separated-values";
var extension4 = "tsv";
var encode5 = (arr) => encode4(arr, "	");
var decode5 = (arr) => decode4(arr, "	");

// src/defaults/datauri.js
var encode6 = (o2) => {
  var byteString = atob(o2.split(",")[1]);
  const ab = new ArrayBuffer(byteString.length);
  var ia = new Uint8Array(ab);
  for (var i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return iab;
};

// node_modules/safari-14-idb-fix/dist/index.js
function idbReady() {
  var isSafari = !navigator.userAgentData && /Safari\//.test(navigator.userAgent) && !/Chrom(e|ium)\//.test(navigator.userAgent);
  if (!isSafari || !indexedDB.databases)
    return Promise.resolve();
  var intervalId;
  return new Promise(function(resolve) {
    var tryIdb = function() {
      return indexedDB.databases().finally(resolve);
    };
    intervalId = setInterval(tryIdb, 100);
    tryIdb();
  }).finally(function() {
    return clearInterval(intervalId);
  });
}
var dist_default = idbReady;

// node_modules/idb-keyval/dist/index.js
function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.oncomplete = request.onsuccess = () => resolve(request.result);
    request.onabort = request.onerror = () => reject(request.error);
  });
}
function createStore(dbName, storeName) {
  const dbp = dist_default().then(() => {
    const request = indexedDB.open(dbName);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    return promisifyRequest(request);
  });
  return (txMode, callback) => dbp.then((db) => callback(db.transaction(storeName, txMode).objectStore(storeName)));
}
var defaultGetStoreFunc;
function defaultGetStore() {
  if (!defaultGetStoreFunc) {
    defaultGetStoreFunc = createStore("keyval-store", "keyval");
  }
  return defaultGetStoreFunc;
}
function get(key, customStore = defaultGetStore()) {
  return customStore("readonly", (store) => promisifyRequest(store.get(key)));
}
function set(key, value, customStore = defaultGetStore()) {
  return customStore("readwrite", (store) => {
    store.put(value, key);
    return promisifyRequest(store.transaction);
  });
}

// src/utils/parse.utils.js
var objToString = (obj) => {
  let ret = "{";
  for (let k in obj) {
    let v = obj[k];
    if (typeof v === "function") {
      v = v.toString();
    } else if (v instanceof Array) {
      v = JSON.stringify(v);
    } else if (typeof v === "object" && !!v) { // Pass on null and undefined
      v = objToString(v);
    } else if (typeof v === "string") {
      v = `"${v}"`;
    }
    else {
      v = `${v}`;
    }
    ret += `
  ${k}: ${v},`;
  }
  ret += "\n}";
  return ret;
};

// src/FileManager.js
var FileManager = class {
  constructor(options = {}) {
    __publicField(this, "createFileSystemInfo", () => {
      return {
        system: {},
        types: {},
        list: [],
        n: 0
      };
    });
    __publicField(this, "reset", () => {
      this.changelog = [];
      this.files = this.createFileSystemInfo();
    });
    __publicField(this, "get", async (file2, options = {}) => {
      if (!options.directory)
        options.directory = this.directoryName;
      const rangeFile = new RangeFile(file2, Object.assign({ manager: this, debug: this.debug }, options));
      await rangeFile.init();
      return rangeFile;
    });
    __publicField(this, "encode", async (o2, fileInfo) => {
      const { mimeType: mimeType5, zipped } = this.getInfo(fileInfo);
      let buffer = "";
      if (mimeType5 && (mimeType5.includes("image/") || mimeType5.includes("video/")))
        content = encode6(o2);
      const extension5 = Object.values(this.extensions).find((o3) => o3.mimeType === mimeType5);
      if (extension5 && extension5.encode instanceof Function)
        buffer = extension5.encode(o2);
      else {
        console.warn(`No encoder for ${mimeType5}. Defaulting to text...`);
        buffer = encode(o2);
      }
      if (zipped)
        buffer = await encode2(buffer);
      return buffer;
    });
    __publicField(this, "getInfo", (file2) => {
      let [name, ...extension5] = (file2.name ?? "").split(".");
      let mimeType5 = file2.type;
      const zipped = mimeType5 === this.registry["gz"] || extension5.includes("gz");
      if (zipped)
        extension5.pop();
      if (zipped || !mimeType5)
        mimeType5 = this.registry[extension5[0]];
      return { mimeType: mimeType5, zipped, extension: extension5.join(".") };
    });
    __publicField(this, "decode", async (o2, fileInfo) => {
      const { mimeType: mimeType5, zipped } = this.getInfo(fileInfo);
      if (zipped)
        o2 = await decode2(o2, mimeType5);
      if (mimeType5 && (mimeType5.includes("image/") || mimeType5.includes("video/")))
        return o2.dataurl;
      const extension5 = Object.values(this.extensions).find((o3) => o3.mimeType === mimeType5);
      if (extension5 && extension5.decode instanceof Function)
        return extension5.decode(o2);
      else {
        console.warn(`No decoder for ${mimeType5}. Defaulting to text...`);
        return decode(o2);
      }
    });
    __publicField(this, "extend", (ext) => {
      this.extensions[ext.mimeType] = ext;
      const guessExtension = ext.mimeType.split("-").splice(-1)[0];
      this.registry[ext.extension ?? guessExtension] = ext.mimeType;
    });
    __publicField(this, "toLoad", (name) => {
      return this.ignore.reduce((a, b) => a * !name.includes(b), true);
    });
    __publicField(this, "load", async (file2, options) => {
      let path = options.path;
      const files = options.files ?? this.files;
      const toLoad = this.toLoad(file2.name ?? file2.path);
      if (toLoad) {
        if (!path)
          path = file2.webkitRelativePath ?? file2.relativePath ?? file2.path ?? "";
        const fileOptions = { path, directory: this.directoryName };
        if (!(file2 instanceof RangeFile)) {
          let addToLog;
          if (!(file2 instanceof FileSystemFileHandle)) {
            const pathWithoutName = path.split("/").slice(0, -1).join("/");
            fileOptions.parent = await this.open(pathWithoutName, "directory", false);
            addToLog = true;
          }
          file2 = await this.get(file2, fileOptions);
          if (addToLog)
            this.changelog.push(file2);
        }
        this.groupConditions.forEach((func) => func(file2, files));
        return file2;
      } else
        console.warn(`Ignoring ${file2.name}`);
    });
    __publicField(this, "addGroup", (condition) => {
      this.groupConditions.add(condition);
    });
    __publicField(this, "addDefaultGroups", () => {
      this.addGroup((file2, files) => {
        let target = files.system;
        let split = file2.path.split("/");
        split = split.slice(0, split.length - 1);
        if (file2.path)
          split.forEach((k, i) => {
            if (!target[k])
              target[k] = {};
            target = target[k];
          });
        target[file2.name] = file2;
      });
      this.addGroup((file2, files) => {
        const extension5 = file2.extension ?? file2.name;
        if (extension5) {
          if (!files.types[extension5])
            files.types[extension5] = [];
          files.types[extension5].push(file2);
        }
      });
      this.addGroup((_, files) => {
        files.n++;
      });
      this.addGroup((file2, files) => {
        files.list.push(file2);
      });
    });
    __publicField(this, "request", request_default);
    __publicField(this, "verifyPermission", async (fileHandle, withWrite) => {
      const opts = {};
      if (withWrite)
        opts.mode = "readwrite";
      const state = await fileHandle.queryPermission(opts);
      if (await state === "granted")
        return true;
      const requestState = await fileHandle.requestPermission(opts);
      if (requestState === "granted")
        return true;
      return false;
    });
    __publicField(this, "mountCache", async (progressCallback) => {
      let dirHandle = await get(this.directoryCacheName);
      if (dirHandle) {
        console.log(`Loaded cached mount "${dirHandle.name}" from IndexedDB.`);
        return await this.mount(dirHandle, progressCallback);
      } else
        return;
    });
    __publicField(this, "getSubsystem", async (path) => {
      const files = this.createFileSystemInfo();
      const split = path.split("/");
      const subDir = split.shift();
      path = split.join("/");
      let target = this.files.system[subDir];
      split.forEach((str) => target = target[str]);
      let drill = async (target2, base) => {
        for (let key in target2) {
          const newBase = base ? base + "/" + key : key;
          const file2 = target2[key];
          if (file2 instanceof RangeFile)
            await this.load(file2, { path: newBase, files });
          else
            await drill(file2, newBase);
        }
      };
      await drill(target, path);
      return files;
    });
    __publicField(this, "mount", async (fileSystemInfo, progressCallback) => {
      this.reset();
      if (!fileSystemInfo)
        fileSystemInfo = await window.showDirectoryPicker();
      await set(this.directoryCacheName, fileSystemInfo);
      if (fileSystemInfo instanceof FileSystemDirectoryHandle) {
        await this.createLocalFilesystem(fileSystemInfo, progressCallback);
      } else if (typeof fileSystemInfo === "string") {
        this.directoryName = fileSystemInfo;
        await this.request(fileSystemInfo, { mode: "cors" }, progressCallback).then((ab) => {
          let datasets = JSON.parse(new TextDecoder().decode(ab));
          const drill = (o2) => {
            for (let key in o2) {
              const target = o2[key];
              const toLoad = this.toLoad(key);
              if (toLoad) {
                if (typeof target === "string") {
                  const file2 = {
                    origin: this.directoryName,
                    path: target,
                    options: {
                      mode: "cors"
                    }
                  };
                  this.load(file2);
                } else
                  drill(target);
              }
            }
          };
          drill(datasets);
        }).catch((e) => {
          console.error("File System Load Error", e);
        });
      } else
        await this.load(fileSystemInfo);
      return this.files;
    });
    __publicField(this, "iterAsync", async (iterable, asyncCallback) => {
      const promises = [];
      let i = 0;
      for await (const entry of iterable) {
        promises.push(asyncCallback(entry, i));
        i++;
      }
      const arr = await Promise.all(promises);
      return arr;
    });
    __publicField(this, "onhandle", async (handle, base = "", progressCallback) => {
      await this.verifyPermission(handle);
      if (handle.name != this.directoryName)
        base = base ? `${base}/${handle.name}` : handle.name;
      const files = [];
      if (handle.kind === "file") {
        if (progressCallback instanceof Function)
          files.push({ handle, base });
        else
          await this.load(handle, { path: base });
      } else if (handle.kind === "directory") {
        const toLoad = this.toLoad(handle.name);
        if (toLoad) {
          const arr = await this.iterAsync(handle.values(), (entry) => {
            return this.onhandle(entry, base, progressCallback);
          });
          files.push(...arr.flat());
        }
      }
      if (!base) {
        let count = 0;
        await this.iterAsync(files, async (o2) => {
          await this.load(o2.handle, { path: o2.base });
          count++;
          progressCallback(this.directoryName, count / files.length, files.length);
        });
      }
      return files;
    });
    __publicField(this, "createLocalFilesystem", async (handle, progressCallback) => {
      this.directoryName = handle.name;
      this.native = handle;
      await this.onhandle(handle, null, progressCallback);
    });
    __publicField(this, "sync", async () => {
      return await this.iterAsync(this.files.list, async (entry) => await entry.sync());
    });
    __publicField(this, "save", (progressCallback) => {
      return new Promise(async (resolve, reject) => {
        let i = 0;
        await this.iterAsync(this.files.list, async (rangeFile, j) => {
          await rangeFile.save();
          i++;
          if (progressCallback instanceof Function)
            progressCallback(this.directoryName, i / this.files.list.length, this.files.list.length);
        });
        this.changelog = [];
        resolve();
      });
    });
    __publicField(this, "dragHandler", async (e) => {
      e.preventDefault();
      const fileHandlesPromises = [...e.dataTransfer.items].filter((item) => item.kind === "file").map((item) => item.getAsFileSystemHandle());
      for await (const handle of fileHandlesPromises) {
        this.createLocalFilesystem(handle);
      }
    });
    __publicField(this, "delete", async (name, parent) => {
      return await parent.removeEntry(name, { recursive: true });
    });
    __publicField(this, "rename", async (name) => {
      return await file.move(name);
    });
    __publicField(this, "move", async (directory, name) => {
      return await file.move(directory, name);
    });
    __publicField(this, "getPath", async (file2, parent) => {
      return await parent.resolve(file2);
    });
    __publicField(this, "open", async (path, type, create = true) => {
      let system = this.files.system;
      let directoryHandle = this.native;
      const pathTokens = path.split("/");
      let dirTokens = pathTokens.slice(0, -1);
      const filename = pathTokens.slice(-1)[0];
      if (type === "directory")
        dirTokens = [...dirTokens, filename];
      if (dirTokens.length > 0) {
        for (const token of dirTokens) {
          directoryHandle = await directoryHandle.getDirectoryHandle(token, { create: true });
          if (!system[token])
            system[token] = {};
          system = system[token];
        }
      }
      if (type === "directory")
        return directoryHandle;
      else {
        const existingFile = system[filename];
        if (existingFile)
          return existingFile;
        else {
          const fileHandle = directoryHandle.getFileHandle(filename, { create });
          return await this.load(fileHandle);
        }
      }
    });
    __publicField(this, "getPath", (path, root = "") => {
      const dirTokens = root.split("/");
      dirTokens.pop();
      const extensionTokens = path.split("/").filter((str) => {
        if (str === "..") {
          if (dirTokens.length == 0)
            console.error("Derived path is going out of the valid filesystem!");
          dirTokens.pop();
          return false;
        } else if (str === ".")
          return false;
        else
          return true;
      });
      const newPath = extensionTokens.join("/");
      return newPath;
    });
    __publicField(this, "#import", async (text) => {
      const moduleDataURI = "data:text/javascript;base64," + btoa(text);
      let imported = await import(moduleDataURI);
      if (imported.default && Object.keys(imported).length === 1)
        imported = imported.default;
      return imported;
    });
    __publicField(this, "import", async (file2) => {
      let text = await file2.body;
      try {
        return await this["#import"](text);
      } catch (e) {
        console.warn(`${this.name} contains ES6 imports. Manually importing these modules...`);
        const importInfo = {};
        var re = /import([ \n\t]*(?:[^ \n\t\{\}]+[ \n\t]*,?)?(?:[ \n\t]*\{(?:[ \n\t]*[^ \n\t"'\{\}]+[ \n\t]*,?)+\})?[ \n\t]*)from[ \n\t]*(['"])([^'"\n]+)(?:['"])/g;
        let m;
        do {
          m = re.exec(text);
          if (m == null)
            m = re.exec(text);
          if (m) {
            text = text.replace(m[0], ``);
            const variables = m[1].trim().split(",");
            importInfo[m[3]] = variables;
          }
        } while (m);
        for (let path in importInfo) {
          const variables = importInfo[path];
          const correctPath = this.getPath(path, file2.path);
          const importFile = await this.open(correctPath, "file", false);
          const imported = await this.import(importFile);
          if (variables.length > 1) {
            variables.forEach((str) => {
              text = `const ${str} = ${objToString(imported[str], false)}
${text}`;

            });
          } else {
            text = `const ${variables[0]} = ${objToString(imported, false)}
${text}`;
          }
        }
        const tryImport = await this["#import"](text);
        return tryImport;
      }
    });
    this.extensions = {};
    this.registry = {};
    this.native = {};
    this.ignore = options.ignore ?? [];
    this.debug = options.debug;
    this.directoryCacheName = "freerangeCache";
    this.directoryName = "";
    this.groupConditions = /* @__PURE__ */ new Set();
    this.extend(json_exports);
    this.extend(text_exports);
    this.extend(tsv_exports);
    this.extend(csv_exports);
    this.addDefaultGroups();
    this.reset();
  }
};
export {
  FileManager,
  RangeFile,
  getInfo_default as getInfo
};
