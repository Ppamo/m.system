#!/bin/bash

SERVER=localhost
PORT=8080

case "$1" in
	update)
		# echo "curl -i -H """Accept: application/json""" -H """Content-Type: application/json""" -X POST -d """$2""" http://$SERVER:$PORT/update"
		curl -i -H "Accept: application/json" -H "Content-Type: application/json" -X POST -d "$2" http://$SERVER:$PORT/update
		echo
		echo
		;;
	stop)
		echo "curl http://$SERVER:$PORT/stop"
		curl http://$SERVER:$PORT/stop
		echo
		echo
		;;
	*)
		echo "command not found"
esac
