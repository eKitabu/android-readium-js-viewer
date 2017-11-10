#include <sstream>
#include <string>
#include <stdio.h>

#include "ppapi/cpp/instance.h"
#include "ppapi/cpp/module.h"
#include "ppapi/cpp/var.h"
#include "ppapi/cpp/var_dictionary.h"
#include "ppapi/cpp/var_array_buffer.h"
#include "ppapi/cpp/file_system.h"
#include "ppapi/utility/completion_callback_factory.h"
#include "ppapi/utility/threading/simple_thread.h"

#include "nacl_io/nacl_io.h"
#include "sys/mount.h"

#include "miniunz/unzip.h"
#include "miniunz/miniunz.h"

#define MAX_PATH_LEN (255)

class UnzipperInstance : public pp::Instance {
public:
  explicit UnzipperInstance(PP_Instance instance)
      : pp::Instance(instance),
        callback_factory_(this),
        filesystem_ready_(false),
        worker_thread_(this) {}

  virtual ~UnzipperInstance() {
    worker_thread_.Join();
  }

  virtual bool Init(uint32_t /*argc*/,
                    const char * /*argn*/ [],
                    const char * /*argv*/ []) {
    worker_thread_.Start();
    nacl_io_init_ppapi(pp_instance(), pp::Module::Get()->get_browser_interface());
    return true;
  }

private:
  pp::CompletionCallbackFactory<UnzipperInstance> callback_factory_;
  bool filesystem_ready_;
  pp::SimpleThread worker_thread_;

  void PostTypedMessage(int communication_channel_id, const std::string& type, const pp::Var& data, bool terminateChannel = true) {
    pp::VarDictionary dict;
    dict.Set("channelId", communication_channel_id);
    dict.Set("type", type);
    dict.Set("data", data);
    dict.Set("terminateChannel", terminateChannel);
    PostMessage(dict);
  }

  void Log(std::string message) {
    PostTypedMessage(0, "log", pp::Var(message), false);
  }

  virtual void HandleMessage(const pp::Var& var_message) {
    PostTypedMessage(0, "echo", var_message, false);

    if (!var_message.is_dictionary()) {
      return;
    }

    pp::VarDictionary message(var_message);

    int channel_id = 0;
    pp::Var channel_id_var = message.Get("channelId");
    if (channel_id_var.is_int()) {
      channel_id = channel_id_var.AsInt();
    }

    std::string type = message.Get("type").AsString();
    if (type == "initfs") {
      pp::Resource filesystem_resource = message.Get("data").AsResource();
      pp::FileSystem filesystem(filesystem_resource);
      InitFileSystem(channel_id, filesystem);
    } else if (type == "unzip" || type == "extract") {
      pp::VarDictionary data(message.Get("data"));
      std::string zip_path = data.Get("absZipPath").AsString();

      if (type == "unzip") {
        // unzip the whole archive to the destination directory
        std::string dest_dir = data.Get("absDestDir").AsString();
        worker_thread_.message_loop().PostWork(
          callback_factory_.NewCallback(&UnzipperInstance::Unzip, channel_id, zip_path, dest_dir));
      } else {
        // extract a single file to an in-memory buffer
        std::string file_path = data.Get("filePath").AsString();
        worker_thread_.message_loop().PostWork(
          callback_factory_.NewCallback(&UnzipperInstance::Extract, channel_id, zip_path, file_path));
      }
    }
  }

  void InitFileSystem(int comm_channel_id, const pp::FileSystem& filesystem) {
    umount("/");

    std::stringstream data;
    data << "filesystem_resource=" << filesystem.pp_resource();

    mount("",           /* source */
          "/",          /* target */
          "html5fs",    /* filesystem type */
          0,            /* mountflags, unused */
          data.str().c_str());  /* additional (key, value) pairs */

    filesystem_ready_ = true;
    PostTypedMessage(comm_channel_id, "success", "");
  }

  void Unzip(int32_t /* result */, int comm_channel_id, const std::string& zip_path, const std::string& dest_dir) {
    unzFile uf = OpenZip(comm_channel_id, zip_path);
    if (uf == NULL) {
      return;
    }

    std::string current_dir;
    if (dest_dir.length() > 0) {
      char temp[MAX_PATH_LEN];
      if (getcwd(temp, MAX_PATH_LEN) == 0) {
        PostTypedMessage(comm_channel_id, "error", "Internal error");
        return;
      }
      current_dir = std::string(temp);

      makedir(dest_dir.c_str());
      chdir(dest_dir.c_str());

    }

    do_extract(uf,      /* zip file */
               0,       /* extract without path */
               1,       /* overwrite */
               NULL);   /* password */

    if (current_dir.length() > 0) {
      chdir(current_dir.c_str());
    }

    unzClose(uf);

    PostTypedMessage(comm_channel_id, "success", "");
  }

  void Extract(int32_t /* result */, int comm_channel_id, const std::string& zip_path, const std::string& file_path) {
    unzFile uf = OpenZip(comm_channel_id, zip_path);
    if (uf == NULL) {
      return;
    }

    decompressedData decompressed = do_extract_onefile(uf, file_path.c_str());

    unzClose(uf);

    printf(" finished with status: %d\n", decompressed.err);

    if (decompressed.err == UNZ_OK) {
      pp::VarArrayBuffer array_buffer(decompressed.size);
      void* dest = array_buffer.Map();
      memcpy(dest, decompressed.buffer, decompressed.size);

      array_buffer.Unmap();
      free(decompressed.buffer);

      PostTypedMessage(comm_channel_id, "success", array_buffer);
    } else {
      std::stringstream message;
      message << "Can't extract file. Error number: " << decompressed.err;
      PostTypedMessage(comm_channel_id, "error", message.str());
    }
  }

  unzFile OpenZip(int comm_channel_id, const std::string& path) {
    if (!filesystem_ready_) {
      PostTypedMessage(comm_channel_id, "error", "File system not initialized, call initfs first!");
      return NULL;
    }

    unzFile uf = unzOpen64(path.c_str());
    if (uf == NULL) {
      std::stringstream message;
      message << "Can't open zip file: " << path;
      PostTypedMessage(comm_channel_id, "error", message.str());
    }

    return uf;
  }

};

class UnzipperModule : public pp::Module {
 public:
  UnzipperModule() : pp::Module() {}
  virtual ~UnzipperModule() {}

  virtual pp::Instance* CreateInstance(PP_Instance instance) {
    return new UnzipperInstance(instance);
  }
};

namespace pp {

Module* CreateModule() {
  return new UnzipperModule();
}

}  // namespace pp
