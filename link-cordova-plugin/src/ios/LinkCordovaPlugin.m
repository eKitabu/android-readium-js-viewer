#import "LinkCordovaPlugin.h"
#import <Cordova/CDV.h>
#import <CommonCrypto/CommonDigest.h>
#import <CommonCrypto/CommonCryptor.h>
#import "libzip_iOS.framework/Versions/A/Headers/zip.h"

@implementation LinkCordovaPlugin

- (NSData*)stod:(NSString*)data
{
    return [data dataUsingEncoding:NSUTF8StringEncoding];
}
- (NSString*)dtos:(NSData*)data
{
    return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
}

- (NSData*)sha256:(NSString*)input
{
    NSData* dataIn = [self stod:input];
    NSMutableData* dataOut = [NSMutableData dataWithLength:CC_SHA256_DIGEST_LENGTH];
    CC_SHA256(dataIn.bytes, (CC_LONG)dataIn.length, dataOut.mutableBytes);
    return [NSData dataWithData:dataOut];
}

- (NSString*)base64_encode:(NSData*)input
{
    return [input base64EncodedStringWithOptions:0];
}

- (NSData*)base64_decode:(NSString*)input
{
    return [[NSData alloc] initWithBase64EncodedString:input options:0];
}

- (NSData*)aes256DecryptData:(NSData*)data WithKey:(NSData*)key
{
    NSMutableData* output = [NSMutableData dataWithLength:data.length - kCCBlockSizeAES128];

    NSData* iv = [data subdataWithRange:NSMakeRange(0, kCCBlockSizeAES128)];
    NSData* input = [data subdataWithRange:NSMakeRange(kCCBlockSizeAES128, data.length - kCCBlockSizeAES128)];

    size_t decryptedBytes = 0;
    CCCryptorStatus cryptStatus = CCCrypt(kCCDecrypt, kCCAlgorithmAES, 0,
                                          key.bytes, kCCKeySizeAES256,
                                          iv.bytes /* initialization vector (optional) */,
                                          input.bytes, input.length, /* input */
                                          (void*)output.bytes, output.length, /* output */
                                          &decryptedBytes);

    output.length = decryptedBytes;
    if (cryptStatus == kCCSuccess)
    {
        return output;
    }
    return nil;
}

- (NSData*) read:(const char*)entry from:(const char*) zip
{
    //Open the ZIP archive
    int err = 0;
    zip_t *z = zip_open(zip, 0, &err);

    //Search for the file of given name
    struct zip_stat st;
    zip_stat_init(&st);
    zip_stat(z, entry, 0, &st);

    //Alloc memory for its uncompressed contents
    char *contents = malloc(sizeof(char) * st.size);

    //Read the compressed file
    zip_file_t *f = zip_fopen(z, entry, ZIP_FL_NOCASE);
    if (!f) {
        NSLog(@"entry %s is null", entry);
        zip_close(z);
        return nil;
    }
    zip_fread(f, contents, st.size);
    zip_fclose(f);

    //And close the archive
    zip_close(z);

    NSData* res = [NSData dataWithBytes:contents length:st.size];
    free(contents);
    return res;
}

- (void)getResource:(CDVInvokedUrlCommand*)command
{
    [self.commandDelegate runInBackground:^{
        const char* epubPath = [[command.arguments objectAtIndex:0] cStringUsingEncoding:NSUTF8StringEncoding];
        const char* entryPath = [[command.arguments objectAtIndex:1]  cStringUsingEncoding:NSUTF8StringEncoding];
        NSData* content = [self read:entryPath from:epubPath];
        CDVPluginResult* pluginResult = nil;
        if (content != nil) {
            pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_OK messageAsArrayBuffer:content];
        } else {
            pluginResult = [CDVPluginResult resultWithStatus:CDVCommandStatus_ERROR messageAsString:@"resource not found"];
        }

        [self.commandDelegate sendPluginResult:pluginResult callbackId:command.callbackId];
    }];
}

@end