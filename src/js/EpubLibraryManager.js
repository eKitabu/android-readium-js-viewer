define(['jquery', './ModuleConfig', './PackageParser', './workers/WorkerProxy', 'StorageManager', 'i18nStrings', 'URIjs', './EpubLibraryOPDS', 'readium_js/epub-fetch/publication_fetcher'], function ($, moduleConfig, PackageParser, WorkerProxy, StorageManager, Strings, URI, EpubLibraryOPDS, PublicationFetcher) {

    var LibraryManager = function(){
    };

    var adjustEpubLibraryPath = function(path) {

        if (!path || !moduleConfig.epubLibraryPath) return path;

        var pathUri = undefined;
        try {
            pathUri = new URI(path);
        } catch(err) {
            console.error(err);
            console.log(path);
        }

        if (pathUri && pathUri.is("absolute")) return path; // "http://", "https://", "data:", etc.

        if (path.indexOf("epub_content/") == 0) {
            path = path.replace("epub_content/", "");
        }

        var parts = moduleConfig.epubLibraryPath.split('/');
        parts.pop();

        var root = parts.join('/');
        path = root + (path.charAt(0) == '/' ? '' : '/') + path;

        return path;
    };

    function fetchEpubMetadata(path) {
      var deferred = $.Deferred();
      var publicationFetcher = new PublicationFetcher(path, null, window);

      publicationFetcher.initialize(function() {
        publicationFetcher.getPackageDom(function(packageDom) {
          var epubData = _.chain(PackageParser.parsePackageDom(packageDom))
            .pick('author', 'title', 'coverHref')
            .extend({ rootUrl: path })
            .value();

          if (!epubData.coverHref) {
            deferred.resolve(epubData);
            return;
          }

          var coverHref = epubData.coverHref;
          epubData.coverHref = null;
          epubData.coverLoad = function() {
            var coverDeferred = $.Deferred();

            // TODO: setPackageMetadata is needed to initialize
              // the EncryptionHandler -- etsakov@2017.11.24
              publicationFetcher.setPackageMetadata({ id: '' }, function() {
                publicationFetcher.relativeToPackageFetchFileContents(coverHref, 'blob', function(imageBlob) {
                  epubData.coverHref = window.URL.createObjectURL(imageBlob);
                  coverDeferred.resolve(epubData);
                }, function(err) {
                  console.error(err);
                  coverDeferred.resolve(epubData);
                });
              });

            return coverDeferred.promise();
          }

          deferred.resolve(epubData);

        });
      });

      return deferred.promise();
    }

    LibraryManager.prototype = {

       _getFullUrl : function(packageUrl, relativeUrl){
            if (!relativeUrl){
                return null;
            }

            var parts = packageUrl.split('/');
            parts.pop();

            var root = parts.join('/');

            return root + (relativeUrl.charAt(0) == '/' ? '' : '/') + relativeUrl
        },

        // TODO: see disabled usage in EpubLibrary.js
        // resetLibraryData: function() {
        //     this.libraryData = undefined;
        // },

        // TODO: Refactor this callback abomination using promises. -- etsakov@2017.11.19
        retrieveAvailableEpubs : function(success, error){
          if (this.libraryData) {
              success(this.libraryData);
              return;
          }

          var self = this;
          var libraryPath = 'file:///sdcard/eKitabu/';

          function logError(err) {
            console.error(err);
            error(err);
          }

          cordova.plugins.permissions.requestPermission(
            cordova.plugins.permissions.READ_EXTERNAL_STORAGE,
            function (status) {
              if (!status.hasPermission) {
                logError('Failed to obtain READ_EXTERNAL_STORAGE permission');
                return;
              }

              resolveLocalFileSystemURL(libraryPath, function(dir) {
                var reader = dir.createReader();
                reader.readEntries(function(entries) {
                  var epubPromises = _.chain(entries)
                  .filter(function(entry) {
                    return entry.name.endsWith('.epub');
                  })
                  .map(function(entry) {
                    // entry.nativeURL encodes whitespaces -- etsakov@2017.11.13
                    return fetchEpubMetadata('file://' + entry.fullPath);
                  })
                  .value();

                  // TODO: Load covers asynchronously. -- etsakov@2017.11.24
                  //$.when.apply($, epubPromises).then(function() {
                    //var epubs = arguments;
                    self.libraryData = epubPromises;
                    success(epubs);
                  //});

                }, logError);
              }, logError);
            }, logError);
          return;

            if (this.libraryData){
                success(this.libraryData);
                return;
            }

            var self = this;

            var indexUrl = moduleConfig.epubLibraryPath
                        ? StorageManager.getPathUrl(moduleConfig.epubLibraryPath)
                        : StorageManager.getPathUrl('/epub_library.json');

            var dataFail = function() {
                console.error("Ebook library fail: " + indexUrl);

                self.libraryData = [];
                success([]);
            };

            var dataSuccess = function(data) {
                console.log("Ebook library success: " + indexUrl);

                if (moduleConfig.epubLibraryPath) {
                    for (var i = 0; i < data.length; i++) {
                        data[i].coverHref = adjustEpubLibraryPath(data[i].coverHref);
                        data[i].rootUrl = adjustEpubLibraryPath(data[i].rootUrl);
                    }
                }

                self.libraryData = data;
                success(data);
            };

            if (/\.json$/.test(indexUrl)) {

                $.getJSON(moduleConfig.epubLibraryPath, function(data){
                    dataSuccess(data);
                }).fail(function(){
                    dataFail();
                });
            } else {
                EpubLibraryOPDS.tryParse(indexUrl, dataSuccess, dataFail);
            }
        },

        deleteEpubWithId : function(id, success, error){
            WorkerProxy.deleteEpub(id, this.libraryData, {
                success: this._refreshLibraryFromWorker.bind(this, success),
                error: error
            });
        },
        retrieveFullEpubDetails : function(packageUrl, rootUrl, rootDir, noCoverBackground, success, error){
            var self = this;

            $.get(packageUrl, function(data){

                if(typeof(data) === "string" ) {
                    var parser = new window.DOMParser;
                    data = parser.parseFromString(data, 'text/xml');
                }
                var jsonObj = PackageParser.parsePackageDom(data, packageUrl);
                jsonObj.coverHref = jsonObj.coverHref ? self._getFullUrl(packageUrl, jsonObj.coverHref) : undefined;
                jsonObj.packageUrl = packageUrl;
                jsonObj.rootDir = rootDir;
                jsonObj.rootUrl = rootUrl;
                jsonObj.noCoverBackground = noCoverBackground;

                success(jsonObj);

            }).fail(error);
        },
        _refreshLibraryFromWorker : function(callback, newLibraryData){
            this.libraryData = newLibraryData;
            callback();
        },
        handleZippedEpub : function(options){
            WorkerProxy.importZip(options.file, this.libraryData, {
                progress : options.progress,
                overwrite: options.overwrite,
                success: this._refreshLibraryFromWorker.bind(this, options.success),
                error : options.error
            });
            //Dialogs.showModalProgress()
            //unzipper.extractAll();
        },
        handleDirectoryImport : function(options){

            var rawFiles = options.files,
                files = {};
            for (var i = 0; i < rawFiles.length; i++){
                 var path = rawFiles[i].webkitRelativePath
                // don't capture paths that contain . at the beginning of a file or dir.
                // These are hidden files. I don't think chrome will ever reference
                // a file using double dot "/.." so this should be safe
                if (path.indexOf('/.') != -1){
                    continue;
                }
                var parts = path.split('/');

                parts.shift();
                var shiftPath = parts.join('/');

                files[shiftPath] = rawFiles[i];
            }

            WorkerProxy.importDirectory(files, this.libraryData, {
                progress : options.progress,
                overwrite: options.overwrite,
                success: this._refreshLibraryFromWorker.bind(this, options.success),
                error : options.error
            });
        },
        handleUrlImport : function(options){
            WorkerProxy.importUrl(options.url, this.libraryData, {
                progress : options.progress,
                overwrite: options.overwrite,
                success: this._refreshLibraryFromWorker.bind(this, options.success),
                error : options.error

            });
        },
        handleMigration : function(options){
            WorkerProxy.migrateOldBooks({
                progress : options.progress,
                success: this._refreshLibraryFromWorker.bind(this, options.success),
                error : options.error
            });
        },
        handleUrl : function(options){

        },
        canHandleUrl : function(){
            return moduleConfig.canHandleUrl;
        },
        canHandleDirectory : function(){
            return moduleConfig.canHandleDirectory;
        }
    }

    window.cleanEntireLibrary = function(){
        StorageManager.deleteFile('/', function(){
            console.log('done');
        }, console.error);
    }
    return new LibraryManager();

});
