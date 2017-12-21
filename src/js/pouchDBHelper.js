define(
['pouchdb', 'readium_js/epub-fetch/Utils'],
function(PouchDB, Utils){
    getPouch = function(name) {
      return new pouchDBWrapper(name)
    }

    function pouchDBWrapper(name) {
      db = new PouchDB(name);

      this.getAll = function(isJqueryPromise = true) {
        // get all items from storage including details
        var es6Promise = db.allDocs({
          include_docs: true
        })
        .then(db => {
          // re-map rows to collection of items
          return db.rows.map(row => {
            return row.doc;
          });
        });
        return isJqueryPromise ? Utils.deferizePromise(es6Promise) : es6Promise;
      }

      this.get = function(id, isJqueryPromise = true) {
        // find item by id
        var es6Promise = db.get(id);
        return isJqueryPromise ? Utils.deferizePromise(es6Promise) : es6Promise;
      }

      this.save = function(item, isJqueryPromise = true) {
        // add or update an item depending on _id
        var es6Promise = item._id ?
        this.update(item) :
        this.add(item);
        return isJqueryPromise ? Utils.deferizePromise(es6Promise) : es6Promise;
      }

      this.add = function(item, isJqueryPromise = true) {
        // add new item
        var es6Promise = db.post(item);
        return isJqueryPromise ? Utils.deferizePromise(es6Promise) : es6Promise;
      }

      this.update = function(item, isJqueryPromise = true) {
        // find item by id
        var es6Promise = db.get(item._id)
        .then(updatingItem => {
          // update item
          Object.assign(updatingItem, item);
          return db.put(updatingItem);
        });
        return isJqueryPromise ? Utils.deferizePromise(es6Promise) : es6Promise;
      }

      this.remove = function(id, isJqueryPromise = true) {
        // find item by id
        var es6Promise = db.get(id)
        .then(item => {
          // remove item
          return db.remove(item);
        });
        return isJqueryPromise ? Utils.deferizePromise(es6Promise) : es6Promise;
      }
    }

    return {
      getPouch: getPouch
    };
});
