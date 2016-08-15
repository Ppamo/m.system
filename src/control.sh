#!/bin/bash

SERVER=localhost
WORKINGDIR=/tmp/mock-server
PORT=8080
MOCK_TRANS_PORT=10005
LONG_MESSAGE="cmd:newad\nphone:98478466\nregion:15\nsource:android\ncategory:7060\naddress_number:2662\nremote_addr:179.4.239.14\nname:Juan Valdivia\nlang:es\nphone_hidden:0\nsubject:Cactus para regalar en matrimonios y eventos\ndigest_present:1\ndigest_present:1\ndigest_present:1\ndigest_present:1\ndigest_present:1\ndigest_present:1\nemail:juanenriquev@hotmail.com\ntype:s\nprice:1290\ngeoposition:-33.50285,-70.75915\nad_id:38716489\nstreet_id:93787\ndo_not_send_mail:1\nad_type:edit\naddress:Calle Monumento\nimage:9402572564.jpg\nimage:9438945668.jpg\nimage:9443505324.jpg\nimage:9413971704.jpg\nimage:9433894163.jpg\nimage:9473739081.jpg\ncompany_ad:1\npay_type:free\nblob:579:body\nbody:Cactus y suculentas surtidas aleatoriamente (30% cactus y 70% suculentas), en macetero de ceráca de 6 cm aprox. Decorados con piedras de colores, encintado en tono definido por el cliente, incluye tarjeta.#012No incluye despacho a domicilio#012Tiempo de entrega: Dependeráe las cantidades solicitadas y stock disponible. #012El valor del souvenir puede variar segúntidad de colores solicitados.#012Pedido míno:50 unid.#012Aviso vádo hasta el 31 de diciembre de 2016 o hasta agotar stock.#012Contacto y fono: Juan Enrique F:+56 9 84784665#012Consulte por nuestro sitio Online\n\npasswd:_1024_Nyc2J7jDyw8k4@?nf38e72a1cc95927105ad3efb79c2078a56a67a20\ncommunes:320\ngeoposition_is_precise:1\ncommit:1\nend\n"

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
		mkdir -p $WORKINGDIR
		echo
		;;
	list)
		find $WORKINGDIR | less
		;;
	hit)
		case "$2" in
			1)
				MSG=$LONG_MESSAGE
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
		printf "$MSG" | nc localhost $MOCK_TRANS_PORT
		;;
	*)
		echo "command not found"
esac
