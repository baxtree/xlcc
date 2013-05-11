#node-xlcc

node-xlcc is an interpreter for xLCC on Node.

#Installation

[1] install GIT from http://git-scm.com/

[2] checkout Node.js from GitHub: git clone https://github.com/joyent/node.git

[3] cd node; select node-v0.4.9: git checkout v0.4.9 

[4] configure and install node-v0.4.9: ./configure ; make install

[5] checkout xlcc from GitHub: git clone git://github.com/baxtree/xlcc.git

[6] install dependencies: cd xlcc; git submodule init; git submodule update

[7] install expat-devel and compile node-expat manually: yum install expat-devel (for Scientific Linux/RedHat/Centos) | apt-get install expat-devel (for Ubuntu/Debian); cd xlcc/lib/node-expat; node-waf configure build

#Usage

node node-xlcc/xlcc.js <IM_NAME.xlc> <JID> <PASSWORD>

#example

sh alice.sh

sh bob.sh
