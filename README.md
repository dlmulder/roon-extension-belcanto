# [Roon](https://roonlabs.com) [Extension](node-roon-api) to provide [source switching, standby](https://github.com/RoonLabs/node-roon-api-source-control), and [volume control](https://github.com/RoonLabs/node-roon-api-volume-control) for many of the [Bel Canto](https://www.belcantodesign.com/) range of devices via [RS232](https://github.com/dlmulder/node-belcanto)

This extension connects to your Bel Canto device (C6i, E1X, EX, EX Black, maybe others) via RS232, and allows Roon to control its volume directly. Convience source switching and display blanking are available for when the extension starts.

A secondary but equal goal is to use a pair of C6i's to be used as DAC/amps for an active crossover driven by a miniDSP Flex Digital. A Raspberry Pi Pico via the new DSPi project can also generate two S/PDIF pairs for the two DAC/amps, so this Roon extension could be used with a Raspberry Pi or similar Roon endpoint with Extensions available.

To support controlling a pair of DAC/amps I added a second serial port field to the Settings, and if there is a second serial port then both DAC/amps are controlled identically.

---------------------

This extension was tested on Bel Canto E1X Integrated and a pair of C6i.

---------------------

	I bought the SH-U35B (not SH-35A) FTDI cable, with RX on the 3.5mm tip, TX on the ring.

	Setup parameters (configured via Roon):
	- Serial Port: USB port on which the RS232 cable is used
	- Source for Convenience Switch: Numerical value of the Bel Canto source which you want to use for Roon
	- Initial Volume: Volume used when the extension starts the Bel Canto equipment
