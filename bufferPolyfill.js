// bufferPolyfill.js

/**
 * 此 polyfill 用於在瀏覽器環境中定義 Node.js 的 Buffer 物件，
 * 並強制定義 Buffer.from 方法，避免出現 "Buffer is not defined" 或 "Buffer.from is not a function" 的錯誤。
 */

// 如果 window.Buffer 不存在，則建立空物件
if (typeof window.Buffer === "undefined") {
  window.Buffer = {};
  console.log("Buffer not found. Creating window.Buffer object.");
}

// 如果 Buffer.from 不存在，則定義一個簡單的版本（僅支援字串與 Array 輸入）
if (typeof window.Buffer.from !== "function") {
  window.Buffer.from = function(input, encoding) {
    if (typeof input === "string") {
      if (encoding && encoding.toLowerCase() !== "utf8") {
        throw new Error("Buffer.from: Only 'utf8' encoding is supported in this polyfill.");
      }
      // 將字串轉為 UTF-8 編碼的 Uint8Array
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
