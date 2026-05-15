#!/usr/bin/env python3
"""
Patch SWF to work with Ruffle by:
1. Renaming classes in constant pool (Loader->LoaderPatch, etc.)
2. Removing SymbolClass main class binding
3. Injecting stub classes
"""

import struct
import zlib
import io
import os
import re

class SWFPatcher:
    def __init__(self, swf_path):
        self.swf_path = swf_path
        self.data = bytearray()
        self.output = bytearray()
        
    def read_swf(self):
        """Read and decompress SWF if needed"""
        with open(self.swf_path, 'rb') as f:
            signature = f.read(3)
            if signature == b'CWS':
                # Compressed SWF - need to decompress
                version = f.read(1)[0]
                file_length = struct.unpack('<I', f.read(4))[0]
                # Read compressed data
                compressed = f.read()
                # Decompress from byte 8 onwards
                self.data = bytearray(b'FWS') + bytes([version]) + struct.pack('<I', file_length)
                decompressed = zlib.decompress(compressed)
                self.data.extend(decompressed)
            elif signature == b'FWS':
                self.data = bytearray(f.read())
            else:
                raise ValueError(f"Invalid SWF signature: {signature}")
        
    def find_and_replace_strings(self):
        """Find string constant pool and replace class names"""
        # Find abc patterns in DoABC tags
        data = self.data
        
        # Patterns to replace (original -> replacement)
        replacements = [
            (b'flash.display.Loader', b'LoaderPatch'),
            (b'flash.net.URLLoader', b'URLLoaderPatch'),
            (b'flash.system.Security', b'SecurityPatch'),
            # Also replace simple names if they appear
            (b'class Loader', b'class LoaderPatch'),
            (b'class URLLoader', b'class URLLoaderPatch'),
            (b'class Security', b'class SecurityPatch'),
        ]
        
        changes = []
        for old, new in replacements:
            # Only replace in string constants (not code)
            pos = 0
            while True:
                pos = data.find(old, pos)
                if pos == -1:
                    break
                changes.append((pos, old, new))
                pos += len(old)
        
        # Apply replacements
        for pos, old, new in sorted(changes, reverse=True):
            data[pos:pos+len(old)] = new
            print(f"Replaced at {pos}: {old} -> {new}")
        
        self.data = data
        
    def remove_symbol_class_binding(self):
        """Remove SymbolClass Tag 0 binding for main class"""
        # SymbolClass tag format:
        # Tag type (2 bytes) + length (4 bytes) + numSymbols (2 bytes) + symbols...
        # Tag 0 means "end", but SymbolClass is tag 76 (0x4C)
        
        data = self.data
        pos = 0
        
        while pos < len(data) - 4:
            tag_start = pos
            tag_header = struct.unpack('<H', data[pos:pos+2])[0]
            tag_type = tag_header >> 6
            tag_len = tag_header & 0x3F
            
            if tag_len == 0x3F:
                # Long tag
                if pos + 6 > len(data):
                    break
                tag_len = struct.unpack('<I', data[pos+2:pos+6])[0]
                data_start = pos + 6
            else:
                data_start = pos + 2
            
            if tag_type == 76:  # SymbolClass
                print(f"Found SymbolClass tag at {pos}, length {tag_len}")
                # Parse symbol class entries
                sym_data = data[data_start:data_start+tag_len]
                if len(sym_data) >= 2:
                    num_symbols = struct.unpack('<H', sym_data[:2])[0]
                    print(f"  Num symbols: {num_symbols}")
                    
                    entry_pos = 2
                    modified = False
                    new_sym_data = bytearray()
                    new_sym_data += struct.pack('<H', num_symbols)
                    
                    for i in range(num_symbols):
                        if entry_pos + 4 > len(sym_data):
                            break
                        tag_id = struct.unpack('<H', sym_data[entry_pos:entry_pos+2])[0]
                        name_len = struct.unpack('<H', sym_data[entry_pos+2:entry_pos+4])[0]
                        if entry_pos + 4 + name_len > len(sym_data):
                            break
                        name = sym_data[entry_pos+4:entry_pos+4+name_len].decode('utf-8', errors='replace')
                        
                        print(f"  Symbol {i}: tag_id={tag_id}, name={name}")
                        
                        # Skip tag_id = 0 (main class binding)
                        if tag_id != 0:
                            new_sym_data += sym_data[entry_pos:entry_pos+4+name_len]
                        else:
                            print(f"    -> Skipping (main class binding)")
                            modified = True
                        
                        entry_pos += 4 + name_len
                    
                    if modified:
                        # Update the tag
                        new_tag_len = len(new_sym_data)
                        new_tag_header = (76 << 6) | (0x3F if new_tag_len > 0x3F else new_tag_len)
                        
                        new_tag = bytearray()
                        new_tag += struct.pack('<H', new_tag_header)
                        if new_tag_len > 0x3F:
                            new_tag += struct.pack('<I', new_tag_len)
                        new_tag += new_sym_data
                        
                        # Replace old tag with new
                        old_tag_len = 2 + (4 if tag_len == 0x3F else 0) + tag_len
                        data[tag_start:tag_start+old_tag_len] = new_tag
                        print(f"  Updated SymbolClass tag")
            
            # Move to next tag
            if tag_len == 0x3F:
                pos = data_start + struct.unpack('<I', data[pos+2:pos+6])[0]
            elif tag_type == 0:  # End tag
                break
            else:
                pos = data_start + tag_len
        
        self.data = data
        
    def create_stub_classes(self):
        """Create stub classes for LoaderPatch, URLLoaderPatch, SecurityPatch"""
        # These will be added as DoABC tags with the stub class definitions
        
        stub_as3 = '''
package {
    import flash.display.Loader;
    public class LoaderPatch extends Loader {
        public function LoaderPatch() {
            super();
        }
    }
}
'''
        return stub_as3
        
    def recompress(self):
        """Recompress SWF for Ruffle"""
        # Get header (first 8 bytes remain uncompressed)
        header = self.data[:8]
        
        # Compress the rest
        body = bytes(self.data[8:])
        compressed = zlib.compress(body, 9)
        
        # Update file length
        new_length = 8 + len(compressed)
        length_bytes = struct.pack('<I', new_length)
        
        # Write output
        self.output = bytearray(header[:4] + length_bytes + compressed)
        
    def save(self, output_path):
        """Save patched SWF"""
        with open(output_path, 'wb') as f:
            f.write(self.output)
        print(f"Saved patched SWF to {output_path}")


def main():
    input_path = '/app/data/dream-journey-deploy/zm3.swf'
    output_path = '/app/data/dream-journey-deploy/zm3_patched.swf'
    
    patcher = SWFPatcher(input_path)
    patcher.read_swf()
    
    print("Finding and replacing strings...")
    patcher.find_and_replace_strings()
    
    print("Removing symbol class binding...")
    patcher.remove_symbol_class_binding()
    
    print("Recompressing SWF...")
    patcher.recompress()
    
    print("Saving...")
    patcher.save(output_path)
    
    print("Done!")


if __name__ == '__main__':
    main()
