#import <Cordova/CDV.h>

@interface LinkCordovaPlugin : CDVPlugin

- (void)getResource:(CDVInvokedUrlCommand*)command;
- (NSData*)aes256DecryptData:(NSData*)data WithKey:(NSData*)key;
- (NSData*)stod:(NSString*)data;
- (NSString*)dtos:(NSData*)data;
- (NSData*)sha256:(NSString*)input;
- (NSString*)base64_encode:(NSData*)input;
- (NSData*)base64_decode:(NSString*)input;
- (NSData*) read:(const char*)entry from:(const char*) zip;
@end
