// bufferPolyfill.js
(function() {
  // 如果 window.Buffer 不存在，則建立一個空物件
  if (typeof window.Buffer === "undefined") {
    window.Buffer = {};
    console.log("Buffer not found. Creating window.Buffer object.");
  }

  // 如果 Buffer.from 尚未定義，則定義一個支援 utf8、base64 與 hex 的版本
  if (typeof window.Buffer.from !== "function") {
    window.Buffer.from = function(input, encoding) {
      if (typeof input === "string") {
        // 若有指定編碼
        if (encoding) {
          var enc = encoding.toLowerCase();
          // 允許 "utf8" 或 "utf-8" 兩種形式
          if (enc === "utf8" || enc === "utf-8") {
            // 處理 utf8：使用 encodeURIComponent/unescape 來實現簡單的 utf8 轉換
            var utf8 = unescape(encodeURIComponent(input));
            var arr = new Uint8Array(utf8.length);
            for (var i = 0; i < utf8.length; i++) {
              arr[i] = utf8.charCodeAt(i);
            }
            return arr;
          } else if (enc === "base64") {
            // 處理 base64：使用 atob 將 base64 轉為二進位字串，再轉換為 Uint8Array
            var binary_string = window.atob(input);
            var len = binary_string.length;
            var bytes = new Uint8Array(len);
            for (var i = 0; i < len; i++) {
              bytes[i] = binary_string.charCodeAt(i);
            }
            return bytes;
          } else if (enc === "hex") {
            // 處理 hex：每兩個 hex 字元代表一個 byte
            var hex = input.toString();
            var length = hex.length / 2;
            var bytes = new Uint8Array(length);
            for (var i = 0; i < length; i++) {
              bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
            }
            return bytes;
          } else {
            // 如果遇到不支援的編碼，顯示警告並使用 utf8 處理
            console.warn("Buffer.from polyfill: Unsupported encoding '" + encoding + "'. Defaulting to 'utf8'.");
            var utf8 = unescape(encodeURIComponent(input));
            var arr = new Uint8Array(utf8.length);
            for (var i = 0; i < utf8.length; i++) {
              arr[i] = utf8.charCodeAt(i);
            }
            return arr;
          }
        } else {
          // 如果未指定編碼，預設視為 utf8
          var utf8 = unescape(encodeURIComponent(input));
          var arr = new Uint8Array(utf8.length);
          for (var i = 0; i < utf8.length; i++) {
            arr[i] = utf8.charCodeAt(i);
          }
          return arr;
        }
      } else if (Array.isArray(input)) {
        return new Uint8Array(input);
      } else {
        console.error("Buffer.from polyfill: Unsupported input type:", input);
        throw new Error("Buffer.from: Unsupported input type.");
      }
    };
    console.log("Custom Buffer.from polyfill defined with utf8/base64/hex support.");
  } else {
    console.log("Buffer.from already defined.");
  }
})();