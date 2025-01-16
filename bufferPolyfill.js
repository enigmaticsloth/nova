// bufferPolyfill.js

/**
 * 如果瀏覽器環境中沒有 Buffer 或 Buffer.from，則手動定義它
 */
if (typeof window.Buffer === "undefined") {
  window.Buffer = {};
  console.log("Buffer not found. Creating window.Buffer object.");
}

if (typeof window.Buffer.from !== "function") {
  window.Buffer.from = function(input, encoding) {
    // 處理字串輸入 (僅支援 utf8)
    if (typeof input === "string") {
      if (encoding && encoding.toLowerCase() !== "utf8") {
        throw new Error("Buffer.from: Only 'utf8' encoding is supported in this polyfill.");
      }
      // 將字串轉為 UTF-8 字元陣列
      var utf8 = unescape(encodeURIComponent(input));
      var arr = [];
      for (var i = 0; i < utf8.length; i++) {
        arr.push(utf8.charCodeAt(i));
      }
      return new Uint8Array(arr);
    } else if (Array.isArray(input)) {
      return new Uint8Array(input);
    } else {
      throw new Error("Buffer.from: Unsupported input type.");
    }
  };
  console.log("Buffer.from polyfill defined.");
} else {
  console.log("Buffer.from already defined.");
}
