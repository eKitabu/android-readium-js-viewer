(function() {
  function cordovize(functionName) {
    return function( /* args*/ ) {
      var defer = $.Deferred(),
        args = _.toArray(arguments);

      cordova.exec(defer.resolve.bind(defer), defer.reject.bind(defer), 'Link', functionName, args);
      return defer.promise();
    };
  }

  window.Link = window.Link || {};

  window.Link.getResource = cordovize('getResource'); //epub, path
  window.Link.browseDirectory = cordovize('browseDirectory'); //suggestedFilePath
  window.Link.onDetach = function (successCb, errorCb) {
    cordova.exec(successCb, errorCb, 'Link', 'onDetach');
  };

  window.Link.androidSubtle = {
    digest: cordovize('digest'), // algo, buffer
    importKey: cordovize('importKey'), // format, keyData, algo, extractable, usages
    decrypt: function(algo, key, cipherText) {
      var defer = $.Deferred();
      cordova.exec(defer.resolve, defer.reject, 'Link', 'decrypt', [{name: algo.name}, key, algo.iv, cipherText]);
      return defer.promise();
    }
  };
})();
