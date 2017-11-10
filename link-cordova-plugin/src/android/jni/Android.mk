LOCAL_PATH := $(call my-dir)
include $(CLEAR_VARS)

LOCAL_MODULE := libzip
LOCAL_SRC_FILES := $(wildcard libzip/*.c)
LOCAL_LDLIBS := -lz -llog

include $(BUILD_SHARED_LIBRARY)