#include <stdio.h>
#include <unistd.h>
#include <stdlib.h>
#include <string.h>
#include <netdb.h>
#include <fcntl.h>
#include <sys/types.h> 
#include <sys/socket.h>
#include <sys/sendfile.h>
#include <sys/stat.h>
#include <netinet/in.h>
#include <arpa/inet.h>

#define BUFFERSIZE 1024
#define PORT 10005
#define TRANSHOST "localhost"
#define TRANSPORT 20005

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
	off_t sendfile_offset;
	int fd, fd_parent, fd_child, clientlen;
	struct sockaddr_in server_addr, client_addr;
	struct hostent *hostp;
	struct stat stat_buf;
	char buffer_in[BUFFERSIZE], buffer_out[BUFFERSIZE], file_path[128];
	char *hostaddrp, *stage="stage01";

	// setup server
	fd_parent = socket(AF_INET, SOCK_STREAM, 0);
	if (fd_parent < 0) {
		error("0> ERROR opening socket");
	}
	setsockopt(fd_parent, SOL_SOCKET, SO_REUSEADDR, (const void *)&optval , sizeof(int));
	bzero((char *) &server_addr, sizeof(server_addr));
	server_addr.sin_family = AF_INET;
	server_addr.sin_addr.s_addr = htonl(INADDR_ANY);
	server_addr.sin_port = htons((unsigned short)PORT);
	if (bind(fd_parent, (struct sockaddr *) &server_addr, sizeof(server_addr)) < 0) {
		error("0> ERROR on binding");
	}
	if (listen(fd_parent, 5) < 0){
		error("0> ERROR on listen");
	}

	clientlen = sizeof(client_addr);
	connection_counter = 0;
	while (1) {
		connection_counter++;

		fd_child = accept(fd_parent, (struct sockaddr *) &client_addr, &clientlen);
		if (fd_child < 0)
			error("0> ERROR on accept");

		hostp = gethostbyaddr((const char *)&client_addr.sin_addr.s_addr, sizeof(client_addr.sin_addr.s_addr), AF_INET);
		if (hostp == NULL){
			perror("ERROR on gethostbyaddr");
		}
		hostaddrp = inet_ntoa(client_addr.sin_addr);
		if (hostaddrp == NULL){
			error("ERROR on inet_ntoa\n");
		}
		printf  ("%i> server established connection with %s (%s)\n", connection_counter, hostp->h_name, hostaddrp);
		
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
			if (isEOM(buffer_in)){
				printf ("%i> EOM: retrieving file\n", connection_counter);
				sprintf(file_path, "%s/%s/%i.in.dump", base_path, stage, connection_counter);
				printf("%i> filepath = %s\n", connection_counter, file_path);
				fd = open(file_path, O_RDONLY);
				if (fd == -1){
					printf("%i> ERROR failed to open file\n", connection_counter);
					continue;
				}

				fstat(fd, &stat_buf);
				sendfile_offset = 0;
				sendfile(fd_child, fd, &sendfile_offset, stat_buf.st_size);

				reading = 0;
			}
		}
		printf("%i> Closing connection\n", connection_counter);
		close(fd_child);
		printf("- - - - - - - - - - - - - - - - - - - - - - - - - - -\n");
	}
}
