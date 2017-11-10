PNACL_TC_PATH=$(NACL_SDK_ROOT)/toolchain/*_pnacl/bin
PNACL_CC=$(PNACL_TC_PATH)/pnacl-clang
PNACL_AR=$(PNACL_TC_PATH)/pnacl-ar
PNACL_RANLIB=$(PNACL_TC_PATH)/pnacl-ranlib

CFLAGS=-O2
ARFLAGS=cr

OUTPUT_DIR := $(abspath ./out)
STATICLIB := $(OUTPUT_DIR)/libminiunz.a
UNZ_OBJS := $(addprefix $(OUTPUT_DIR)/, miniunz.o unzip.o ioapi.o)
ZLIB := $(WEBPORTS_ROOT)/out/build/zlib/install_pnacl/payload/lib/libz.a

all: $(STATICLIB)

.PHONY: all clean

$(OUTPUT_DIR):
	mkdir $(OUTPUT_DIR)

$(OUTPUT_DIR)/%.o: %.c | $(OUTPUT_DIR)
	$(PNACL_CC) -c $(CFLAGS) -o $(OUTPUT_DIR)/$*.o $*.c

$(STATICLIB): $(UNZ_OBJS) $(ZLIB)
	$(PNACL_AR) $(ARFLAGS) $(STATICLIB) $(UNZ_OBJS) $(ZLIB)
	$(PNACL_RANLIB) $(STATICLIB)

clean:
	/bin/rm -f $(OUTPUT_DIR)/*
