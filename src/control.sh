#!/bin/bash

SERVER=localhost
WORKINGDIR=/tmp/mock-server
PORT=8080
MOCK_TRANS_PORT=10005

case "$1" in
	start)
		node /home/jenkins/code/m.system/src/example.js
		;;
	update)
		curl -i -H "Accept: application/json" -H "Content-Type: application/json" -X POST -d "$2" http://$SERVER:$PORT/config
		echo
		echo
		;;
	mode)
		curl -i -H "Accept: application/json" -H "Content-Type: application/json" -X POST -d '{"mode": "'$2'"}' http://$SERVER:$PORT/config
		echo
		echo
		;;
	stage)
		curl -i -H "Accept: application/json" -H "Content-Type: application/json" -X POST -d '{"stage": "'$2'"}' http://$SERVER:$PORT/config
		echo
		echo
		;;
	config)
		curl -i -H "Accept: application/json" -H "Content-Type: application/json" -X GET http://$SERVER:$PORT/config
		echo
		echo
		;;
	stop)
		echo "curl http://$SERVER:$PORT/stop"
		curl http://$SERVER:$PORT/stop
		echo
		echo
		;;
	clean)
		echo "removing folder $WORKINGDIR"
		rm -Rf $WORKINGDIR
		echo
		;;
	hit)
		case "$2" in
			1)
				MSG="cmd:get_account_ads2\nads_quantity:500\naccount_id:1693703\npage_number:0\nall_ad_params:1\ncommit:1\nend\n"
				;;
			2)
				MSG="newline:0A\ncommit:1\nad_id:36248711\ncmd:admail\nmail_type:half_time\nend\n"
				;;
			3)
				MSG="end\n"
				;;
			*)
				MSG="cmd:test\nsubject:1\nend\n"
		esac
		printf "$MSG"
		printf "$MSG" | nc localhost $MOCK_TRANS_PORT
		;;
	*)
		echo "command not found"
esac
