import { assert } from '@ember/debug';
import { get } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { createCache, getValue } from '@glimmer/tracking/primitives/cache';

function _defineProperty(obj, key, value) {
  key = _toPropertyKey(key);
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
function _toPrimitive(input, hint) {
  if (typeof input !== "object" || input === null) return input;
  var prim = input[Symbol.toPrimitive];
  if (prim !== undefined) {
    var res = prim.call(input, hint || "default");
    if (typeof res !== "object") return res;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (hint === "string" ? String : Number)(input);
}
function _toPropertyKey(arg) {
  var key = _toPrimitive(arg, "string");
  return typeof key === "symbol" ? key : String(key);
}
function _initializerDefineProperty(target, property, descriptor, context) {
  if (!descriptor) return;
  Object.defineProperty(target, property, {
    enumerable: descriptor.enumerable,
    configurable: descriptor.configurable,
    writable: descriptor.writable,
    value: descriptor.initializer ? descriptor.initializer.call(context) : void 0
  });
}
function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
  var desc = {};
  Object.keys(descriptor).forEach(function (key) {
    desc[key] = descriptor[key];
  });
  desc.enumerable = !!desc.enumerable;
  desc.configurable = !!desc.configurable;
  if ('value' in desc || desc.initializer) {
    desc.writable = true;
  }
  desc = decorators.slice().reverse().reduce(function (desc, decorator) {
    return decorator(target, property, desc) || desc;
  }, desc);
  if (context && desc.initializer !== void 0) {
    desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
    desc.initializer = undefined;
  }
  if (desc.initializer === void 0) {
    Object.defineProperty(target, property, desc);
    desc = null;
  }
  return desc;
}

var _class, _descriptor;
let Meta = (_class = class Meta {
  constructor() {
    _defineProperty(this, "prevRemote", void 0);
    _defineProperty(this, "peek", void 0);
    _initializerDefineProperty(this, "value", _descriptor, this);
  }
}, (_descriptor = _applyDecoratedDescriptor(_class.prototype, "value", [tracked], {
  configurable: true,
  enumerable: true,
  writable: true,
  initializer: null
})), _class);
function getOrCreateMeta(instance, metas, initializer) {
  let meta = metas.get(instance);
  if (meta === undefined) {
    meta = new Meta();
    metas.set(instance, meta);
    meta.value = meta.peek = typeof initializer === 'function' ? initializer.call(instance) : initializer;
  }
  return meta;
}
function localCopy(memo, initializer) {
  assert(`@localCopy() must be given a memo path as its first argument, received \`${String(memo)}\``, typeof memo === 'string');
  let metas = new WeakMap();
  return ( /* prototype, key, desc */
  ) => {
    let memoFn = obj => get(obj, memo);
    return {
      get() {
        let meta = getOrCreateMeta(this, metas, initializer);
        let {
          prevRemote
        } = meta;
        let incomingValue = memoFn(this);
        if (prevRemote !== incomingValue) {
          // If the incoming value is not the same as the previous incoming value,
          // update the local value to match the new incoming value, and update
          // the previous incoming value.
          meta.value = meta.prevRemote = incomingValue;
        }
        return meta.value;
      },
      set(value) {
        if (!metas.has(this)) {
          let meta = getOrCreateMeta(this, metas, initializer);
          meta.prevRemote = memoFn(this);
          meta.value = value;
          return;
        }
        getOrCreateMeta(this, metas, initializer).value = value;
      }
    };
  };
}
function trackedReset(memoOrConfig) {
  assert(`@trackedReset() must be given a memo path, a memo function, or config object with a memo path or function as its first argument, received \`${String(memoOrConfig)}\``, typeof memoOrConfig === 'string' || typeof memoOrConfig === 'function' || typeof memoOrConfig === 'object' && memoOrConfig !== null && memoOrConfig.memo !== undefined);
  let metas = new WeakMap();
  return (_prototype, key, desc) => {
    let memo, update;
    let initializer = desc.initializer ?? (() => undefined);
    if (typeof memoOrConfig === 'object') {
      memo = memoOrConfig.memo;
      update = memoOrConfig.update ?? initializer;
    } else {
      memo = memoOrConfig;
      update = initializer;
    }
    let memoFn = typeof memo === 'function' ? (obj, last) => memo.call(obj, obj, key, last) : obj => get(obj, memo);
    return {
      get() {
        let meta = getOrCreateMeta(this, metas, initializer);
        let {
          prevRemote
        } = meta;
        let incomingValue = memoFn(this, prevRemote);
        if (incomingValue !== prevRemote) {
          meta.prevRemote = incomingValue;
          meta.value = meta.peek = update.call(this, this, key, meta.peek);
        }
        return meta.value;
      },
      set(value) {
        getOrCreateMeta(this, metas, initializer).value = value;
      }
    };
  };
}
function cached(target, key, value) {
  assert('@cached can only be used on getters', value && value.get);
  let {
    get,
    set
  } = value;
  let caches = new WeakMap();
  return {
    get() {
      let cache = caches.get(this);
      if (cache === undefined) {
        cache = createCache(get.bind(this));
        caches.set(this, cache);
      }
      return getValue(cache);
    },
    set
  };
}
function dedupeTracked() {
  let comparator;
  const descriptor = function (target, key, desc) {
    let {
      initializer
    } = desc;
    let {
      get,
      set
    } = tracked(target, key, desc);
    let values = new WeakMap();
    return {
      get() {
        if (!values.has(this)) {
          let value = initializer?.call(this);
          values.set(this, value);
          set.call(this, value);
        }
        return get.call(this);
      },
      set(value) {
        if (!values.has(this) || !comparator(value, values.get(this))) {
          values.set(this, value);
          set.call(this, value);
        }
      }
    };
  };
  if (arguments.length === 3) {
    comparator = (a, b) => a === b;
    return descriptor(...arguments);
  }
  if (arguments.length === 1 && typeof arguments[0] === 'function') {
    comparator = arguments[0];
    return descriptor;
  }
  assert(`@dedupeTracked() can either be invoked without arguments or with one comparator function, received \`${String(arguments)}\``, false);
}

export { cached, dedupeTracked, localCopy, trackedReset };
//# sourceMappingURL=index.js.map
