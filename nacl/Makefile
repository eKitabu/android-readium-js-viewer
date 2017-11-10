PNACL_TC_PATH := $(NACL_SDK_ROOT)/toolchain/*_pnacl
PNACL_CXX := $(PNACL_TC_PATH)/bin/pnacl-clang++
PNACL_FINALIZE := $(PNACL_TC_PATH)/bin/pnacl-finalize

OUTPUT_DIR := $(abspath ./out)
UNZIPPER_BC := $(OUTPUT_DIR)/unzipper.bc
UNZIPPER_PEXE := $(OUTPUT_DIR)/unzipper.pexe
UNZIPPER_DEBUG_PEXE := $(OUTPUT_DIR)/unzipper.debug.pexe

MINIUNZ_DIR := $(abspath ./miniunz)
MINIUNZ_LIB := $(MINIUNZ_DIR)/out/libminiunz.a

CXXFLAGS := -I$(NACL_SDK_ROOT)/include -I$(NACL_SDK_ROOT)/include/pnacl
PNACL_LIB_PATH := $(NACL_SDK_ROOT)/lib/pnacl
COMMON_LDFAGS := -L$(MINIUNZ_DIR)/out -lppapi_cpp -lppapi -lnacl_io -lminiunz -lz
LDFLAGS_RELEASE := -L$(PNACL_LIB_PATH)/Release $(COMMON_LDFAGS)
LDFLAGS_DEBUG := -L$(PNACL_LIB_PATH)/Debug $(COMMON_LDFAGS)

# Declare the ALL target first, to make the 'all' target the default build
all: release debug

.PHONY: all release debug miniunz clean cleanall

release: miniunz $(UNZIPPER_PEXE)

debug: miniunz $(UNZIPPER_DEBUG_PEXE)

miniunz:
	$(MAKE) -C $(MINIUNZ_DIR)

$(OUTPUT_DIR):
	mkdir $(OUTPUT_DIR)

$(UNZIPPER_PEXE): $(UNZIPPER_BC) | $(OUTPUT_DIR)
	$(PNACL_FINALIZE) -o $@ $<

$(UNZIPPER_DEBUG_PEXE): unzipper.cc $(MINIUNZ_LIB) | $(OUTPUT_DIR)
	$(PNACL_CXX) -o $@ $< -O0 $(CXXFLAGS) $(LDFLAGS_DEBUG)

$(UNZIPPER_BC): unzipper.cc $(MINIUNZ_LIB) | $(OUTPUT_DIR)
	$(PNACL_CXX) -o $@ $< -O2 $(CXXFLAGS) $(LDFLAGS_RELEASE)

clean:
	/bin/rm -f $(OUTPUT_DIR)/*

cleanall: clean
	$(MAKE) -C $(MINIUNZ_DIR) clean
