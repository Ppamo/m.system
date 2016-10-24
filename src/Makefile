all:
	make integration

compile-trans:
	gcc -o mock.controller -lcrypto  mock.trans.c

integration:
	@npm install --save hapi hapi-cors-headers
	@clear
	@is_integrated=$$( grep -c "export MSYSTEM_HOME=" ~/.bashrc);\
	if [ "$$is_integrated" == "0" ]; then \
		echo "export MSYSTEM_HOME=${CURDIR}" >> ~/.bashrc; \
		echo "	la siguiente linea se ha agregado a tu .bashrc"; \
		echo "	export MSYSTEM_HOME=${CURDIR}"; \
	fi
	@if [ -z "$$MSYSTEM_HOME" ]; then \
		echo ""; \
		echo "	MSYSTEM_HOME no esta definida"; \
		echo "	ejecuta el siguiente comando:"; \
		echo "	export MSYSTEM_HOME=${CURDIR}"; \
		echo ""; \
	fi
