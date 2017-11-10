#include <android/log.h>
#include <jni.h>
#include <string.h>
#include "zip.h"

jbyteArray Java_org_apache_cordova_plugin_LinkCordovaPlugin_readZipEntry(JNIEnv* env, jobject thiz, jstring zip, jstring entry)
{
    const char* c_zip = (*env)->GetStringUTFChars(env, zip, 0);
    const char* c_entry = (*env)->GetStringUTFChars(env, entry, 0);
    int err = 0;
    zip_t *z = zip_open(c_zip, 0, &err);
    __android_log_print(ANDROID_LOG_INFO, "libzip", "OPEN STATUS: %d", err);

    //Search for the file of given name
    struct zip_stat st;
    zip_stat_init(&st);
    zip_stat(z, c_entry, 0, &st);

    //Alloc memory for its uncompressed contents
    char *contents = malloc(sizeof(char) * st.size);
    //Read the compressed file
    zip_file_t *f = zip_fopen(z, c_entry, ZIP_FL_NOCASE);
    if (!f) {
        zip_close(z);
        free(contents);
        return NULL;
    }
    zip_fread(f, contents, st.size);
    zip_fclose(f);

    //And close the archive
    zip_close(z);

    jbyteArray array = (*env)->NewByteArray(env, (int)st.size);
    (*env)->SetByteArrayRegion(env, array, 0, st.size, (jbyte*) contents);

    free(contents);
    return array;
}