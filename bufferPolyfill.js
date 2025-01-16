// bufferPolyfill.js

(function() {
  if (typeof window.Buffer === 'undefined') {
    window.Buffer = {};
    console.log("Buffer not found. Creating window.Buffer object.");
  }

  if (typeof window.Buffer.from !== 'function') {
    window.Buffer.from = function(input, encoding) {
      // 如果傳入的 encoding 不是 undefined 且不是 "utf8"（不區分大小寫），則記錄警告，並強制使用 "utf8"
      if (typeof encoding === "string" && encoding.toLowerCase() !== "utf8") {
        console.warn(
          `Buffer.from polyfill: Received unsupported encoding "${encoding}". Only "utf8" encoding is supported; using "utf8" instead.`
        );
        // 將 encoding 改為 "utf8"
        encoding = "utf8";
      }
      
      // 處理字串輸入 (僅支援 utf8)
      if (typeof input === "string") {
        // 因為 encoding 已經被強制為 "utf8"，直接處理
        var utf8 = unescape(encodeURIComponent(input));
        var arr = new Uint8Array(utf8.length);
        for (var i = 0; i < utf8.length; i++) {
          arr[i] = utf8.charCodeAt(i);
        }
        return arr;
      } else if (Array.isArray(input)) {
        return new Uint8Array(input);
      } else {
        console.error("Buffer.from polyfill: Unsupported input type.", input);
        throw new Error("Buffer.from: Unsupported input type.");
      }
    };
    console.log("Buffer.from polyfill defined.");
  } else {
    console.log("Buffer.from already defined.");
  }
})();
