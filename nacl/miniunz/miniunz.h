#ifndef _miniunz_H
#define _miniunz_H

#ifdef __cplusplus
extern "C" {
#endif

#include "unzip.h"

typedef struct {
  int err;
  size_t size;
  void* buffer;
} decompressedData;

extern int do_extract(unzFile uf,
                      int opt_extract_without_path,
                      int opt_overwrite,
                      const char* password);

extern decompressedData do_extract_onefile(unzFile uf,
                                           const char* filename);

extern int makedir(const char* newdir);

#ifdef __cplusplus
}
#endif

#endif /* _miniunz_H */
