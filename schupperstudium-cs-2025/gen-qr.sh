#!/usr/bin/env sh
usage() {
	echo "$0 [input-url] [format=svg]"
	exit 1
}
test -z $1 && usage

url=$1
fmt=${2:-"svg"}
out="qrcode.$fmt"

qrencode -o $out -s4 -d288 -m1 -t$fmt "$url" 

echo $out 
