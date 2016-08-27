#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <netdb.h>
#include <sys/types.h> 
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>

#define BUFFERSIZE 1024

void error(char *msg) {
	perror(msg);
	exit(1);
}

int ensure_file_path(char *file_path){
	char command[256];
	sprintf(command, "mkdir -p $(dirname %s)", file_path);
	system(command);
}

int isEOM(char *message){
	if (strlen(message) == 4){
		if (strstr(message, "end\n") != NULL){
			return 1;
		}
	}
	if (strstr(message, "\nend\0") != NULL){
		return 1;
	}
	return 0;
}

int main(int argc, char **argv) {
	static const char *base_path="/tmp/mock-server/trans";
	int optval = 1, n, reading = 1, connection_counter;
	int fd_parent, fd_child, fd_trans, clientlen;
	struct sockaddr_in server_addr, client_addr, trans_addr;
	struct hostent *hostp, *trans;
	char buffer_in[BUFFERSIZE], buffer_out[BUFFERSIZE], file_path[128];
	char *hostaddrp, *stage, *trans_host;
	FILE *fd_in, *fd_out;
	int mock_port, trans_port;

	if (argc != 5){
		error("0> ERROR not enough parameters");
	}
	mock_port = atoi(argv[1]);
	trans_host = argv[2];
	trans_port = atoi(argv[3]);
	stage = argv[4];
	printf("0> tunnel: %i:%s:%i - stage: %s\n", mock_port, trans_host, trans_port, stage);

	fd_parent = socket(AF_INET, SOCK_STREAM, 0);
	if (fd_parent < 0) {
		error("0> ERROR opening socket");
	}

	setsockopt(fd_parent, SOL_SOCKET, SO_REUSEADDR, (const void *)&optval , sizeof(int));
	bzero((char *) &server_addr, sizeof(server_addr));
	server_addr.sin_family = AF_INET;
	server_addr.sin_addr.s_addr = htonl(INADDR_ANY);
	server_addr.sin_port = htons((unsigned short)mock_port);

	if (bind(fd_parent, (struct sockaddr *) &server_addr, sizeof(server_addr)) < 0) {
		error("0> ERROR on binding");
	}
	if (listen(fd_parent, 5) < 0){
		error("0> ERROR on listen");
	}

	// setup and test trans connection
	fd_trans = socket(AF_INET, SOCK_STREAM, 0);
	if (fd_trans < 0)
		error ("0> ERROR creating trans socket");
	trans = gethostbyname(trans_host);
	if (trans == NULL)
		error("0> ERROR trans host not found");
	bzero((char *) &trans_addr, sizeof(trans_addr));
	trans_addr.sin_family = AF_INET;
	bcopy((char *)trans->h_addr, (char *)&trans_addr.sin_addr.s_addr, trans->h_length);
	trans_addr.sin_port = htons(trans_port);
	n = connect(fd_trans, (struct sockaddr *)&trans_addr, sizeof(trans_addr));
	if (n < 0)
		error("0> ERROR connecting to trans");
	// read from trans
	bzero(buffer_out, BUFFERSIZE);
	read(fd_trans, buffer_out, BUFFERSIZE);
	shutdown(fd_trans, 2);
	if (strcmp(buffer_out, "220 Welcome.\n") != 0)
		error ("0> ERROR handshake with trans failed");
	
	clientlen = sizeof(client_addr);
	connection_counter = 0;
	while (1) {
		connection_counter++;
		fd_child = accept(fd_parent, (struct sockaddr *) &client_addr, &clientlen);
		if (fd_child < 0) {
			error("0> ERROR on accept");
		}

		// creating file
		sprintf(file_path, "%s/%s/%i.in.dump", base_path, stage, connection_counter);
		printf("%i> filepath = %s\n", connection_counter, file_path);
		ensure_file_path(file_path);
		fd_in = fopen(file_path, "w");
		sprintf(file_path, "%s/%s/%i.out.dump", base_path, stage, connection_counter);
		fd_out = fopen(file_path, "w");
		if (fd_in == NULL)
			error("ERROR could not create input log file");
		if (fd_out == NULL)
			error("ERROR could not create output log file");
		
		hostp = gethostbyaddr((const char *)&client_addr.sin_addr.s_addr, sizeof(client_addr.sin_addr.s_addr), AF_INET);
		if (hostp == NULL){
			perror("ERROR on gethostbyaddr");
		}
		hostaddrp = inet_ntoa(client_addr.sin_addr);
		if (hostaddrp == NULL){
			error("ERROR on inet_ntoa\n");
		}
		printf  ("%i> server established connection with %s (%s)\n", connection_counter, hostp->h_name, hostaddrp);
		
		// connect to trans
		fd_trans = socket(AF_INET, SOCK_STREAM, 0);
		n = connect(fd_trans, (struct sockaddr *) &trans_addr, sizeof(trans_addr));
		if (n < 0){
			printf("%i> ERROR connecting to trans - %i\n", connection_counter, n);
		}

		reading = 1;
		while (reading){
			bzero(buffer_in, BUFFERSIZE);
			n = read(fd_child, buffer_in, BUFFERSIZE);
			if (n == 0){
				printf("%i> end of message\n", connection_counter);
				reading = 0;
				continue;
			}
			if (n < 0){
				printf("%i> ERROR reading from socket", connection_counter);
				reading = 0;
				continue;
			}
			// printf("%i> server received %d bytes:\n", connection_counter, n);
			write(fd_trans, buffer_in, n);
			fwrite(buffer_in, 1, n, fd_in);
			
			if (isEOM(buffer_in)){
				// printf("%i> EOM\n", connection_counter);
				// read from trans socket
				bzero(buffer_out, BUFFERSIZE);
				n = read(fd_trans, buffer_out, BUFFERSIZE);
				// printf("%i> readed %i chars:\n%s\n", connection_counter, n, buffer_out);
				while (n > 0){
					// printf("%i> writting back %i chars.\n", connection_counter, n);
					write(fd_child, buffer_out, n);
					fwrite(buffer_out, 1, n, fd_out);
					bzero(buffer_out, BUFFERSIZE);
					n = read(fd_trans, buffer_out, BUFFERSIZE);
					if (n < 0)
						perror("ERROR couldn't read from trans");
				}
				reading = 0;
			}
			else {
				// printf("%i> Not EOM\n", connection_counter);
			}
		}
		printf("%i> Closing connection\n", connection_counter);
		fclose(fd_in);
		fclose(fd_out);
		close(fd_trans);
		close(fd_child);
		printf("- - - - - - - - - - - - - - - - - - - - - - - - - - -\n");
	}
}
